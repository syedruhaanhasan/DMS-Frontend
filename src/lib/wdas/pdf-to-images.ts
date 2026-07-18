/**
 * Renders every page of a PDF to a PNG data URL so it can be displayed inline
 * as a viewable image (e.g. inside the document content area).
 *
 * pdf.js relies on browser-only globals (DOMMatrix, canvas), so it is imported
 * lazily inside the function to avoid being evaluated during server rendering.
 */
export async function renderPdfToImages(data: ArrayBuffer, scale = 1.5): Promise<string[]> {
  const pdfjsLib = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const images: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    const context = canvas.getContext("2d");
    if (!context) continue;

    await page.render({ canvasContext: context, viewport, canvas }).promise;
    images.push(canvas.toDataURL("image/png"));
    page.cleanup();
  }

  await pdf.destroy();
  return images;
}

export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}
