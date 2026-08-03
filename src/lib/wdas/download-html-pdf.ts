import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

function sanitizeFileName(name: string): string {
  return name
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80) || "document";
}

/**
 * Renders HTML content into a multi-page PDF and triggers a browser download.
 * Includes typed body content, images, tables, and lists from the editor.
 */
export async function downloadHtmlAsPdf(options: {
  title: string;
  html: string;
  meta?: { label: string; value: string }[];
  fileName?: string;
}): Promise<void> {
  const { title, html, meta = [], fileName } = options;
  if (!html.trim() || isHtmlEmpty(html)) {
    throw new Error("Add some document content before downloading a PDF.");
  }

  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;left:-10000px;top:0;width:794px;padding:48px;background:#fff;color:#111;font-family:Inter,Arial,sans-serif;font-size:14px;line-height:1.7;z-index:-1;";

  const metaHtml = meta
    .filter((m) => m.value.trim())
    .map(
      (m) =>
        `<div style="font-size:12px;color:#555;margin-bottom:4px"><strong>${escapeHtml(m.label)}:</strong> ${escapeHtml(m.value)}</div>`,
    )
    .join("");

  host.innerHTML = `
    <div style="border-bottom:2px solid #ffc400;padding-bottom:16px;margin-bottom:24px">
      <div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#a16207;font-weight:600;margin-bottom:8px">VeriFlow Document</div>
      <h1 style="margin:0;font-size:24px;line-height:1.25;color:#111">${escapeHtml(title || "Untitled document")}</h1>
      ${metaHtml ? `<div style="margin-top:12px">${metaHtml}</div>` : ""}
    </div>
    <div class="wysiwyg-content vf-pdf-body">${html}</div>
  `;

  const style = document.createElement("style");
  style.textContent = `
    .vf-pdf-body { line-height: 1.7; color: #111; }
    .vf-pdf-body h1 { font-size: 20px; font-weight: 700; margin: 0 0 12px; }
    .vf-pdf-body h2 { font-size: 17px; font-weight: 650; margin: 16px 0 8px; }
    .vf-pdf-body h3 { font-size: 15px; font-weight: 600; margin: 14px 0 8px; }
    .vf-pdf-body p { margin: 0 0 10px; }
    .vf-pdf-body b, .vf-pdf-body strong { font-weight: 700; }
    .vf-pdf-body i, .vf-pdf-body em { font-style: italic; }
    .vf-pdf-body u { text-decoration: underline; }
    .vf-pdf-body a { color: #2563eb; text-decoration: underline; }
    .vf-pdf-body ul { list-style: disc; margin: 0 0 12px; padding-left: 22px; }
    .vf-pdf-body ol { list-style: decimal; margin: 0 0 12px; padding-left: 22px; }
    .vf-pdf-body li { display: list-item; margin: 2px 0; }
    .vf-pdf-body blockquote { margin: 12px 0; padding: 10px 14px; border-left: 4px solid #ffc400; background: #fff8e6; border-radius: 6px; }
    .vf-pdf-body table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    .vf-pdf-body td, .vf-pdf-body th { border: 1px solid #d4d4d4; padding: 8px; vertical-align: top; }
    .vf-pdf-body img { display: inline-block; max-width: 100%; height: auto; margin: 10px 0; border-radius: 6px; }
    .vf-pdf-body hr { border: none; border-top: 1px solid #e5e5e5; margin: 16px 0; }
    .vf-pdf-body font[size="1"] { font-size: 10px; }
    .vf-pdf-body font[size="2"] { font-size: 13px; }
    .vf-pdf-body font[size="3"] { font-size: 16px; }
    .vf-pdf-body font[size="4"] { font-size: 18px; }
    .vf-pdf-body font[size="5"] { font-size: 24px; }
    .vf-pdf-body font[size="6"] { font-size: 32px; }
    .vf-pdf-body font[size="7"] { font-size: 48px; }
  `;
  host.appendChild(style);
  document.body.appendChild(host);

  try {
    // Wait for images inside the editor HTML to load (data URLs / remote).
    await waitForImages(host);

    const canvas = await html2canvas(host, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: 794,
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 28;
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;

    const imgWidth = usableWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const pageCanvas = document.createElement("canvas");
    const pageCtx = pageCanvas.getContext("2d");
    if (!pageCtx) throw new Error("Could not prepare PDF pages.");

    const pxPerPt = canvas.width / imgWidth;
    const pageHeightPx = usableHeight * pxPerPt;
    let rendered = 0;
    let pageIndex = 0;

    while (rendered < canvas.height) {
      const sliceHeight = Math.min(pageHeightPx, canvas.height - rendered);
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;
      pageCtx.fillStyle = "#ffffff";
      pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      pageCtx.drawImage(
        canvas,
        0,
        rendered,
        canvas.width,
        sliceHeight,
        0,
        0,
        canvas.width,
        sliceHeight,
      );

      const sliceData = pageCanvas.toDataURL("image/jpeg", 0.92);
      const sliceHeightPt = sliceHeight / pxPerPt;
      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(sliceData, "JPEG", margin, margin, imgWidth, sliceHeightPt);

      rendered += sliceHeight;
      pageIndex += 1;
    }

    const outName = `${sanitizeFileName(fileName || title)}.pdf`;
    pdf.save(outName);
  } finally {
    host.remove();
  }
}

function isHtmlEmpty(html: string): boolean {
  const el = document.createElement("div");
  el.innerHTML = html;
  return !el.textContent?.trim() && el.querySelectorAll("img").length === 0;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        }),
    ),
  );
}
