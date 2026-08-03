/** Shared helpers so portaled Select/Popover/Dropdown don't dismiss parent Dialog/Sheet. */

/** Ignore Dialog/Sheet dismiss for a short window after Select interaction (ghost-click fix). */
let dismissGuardUntil = 0;

export function armPortaledOverlayDismissGuard(ms = 400) {
  dismissGuardUntil = Date.now() + ms;
}

export function isDismissGuardActive(): boolean {
  return Date.now() < dismissGuardUntil;
}

export function isPortaledOverlayTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest("[data-slot='select-content']") ||
      target.closest("[data-radix-select-content]") ||
      target.closest("[data-radix-popper-content-wrapper]") ||
      target.closest("[data-radix-select-viewport]") ||
      target.closest('[role="listbox"]') ||
      target.closest('[role="option"]'),
  );
}

/** True when a Select (or similar) dropdown is currently open in the document. */
export function hasOpenPortaledOverlay(): boolean {
  return Boolean(
    document.querySelector('[data-slot="select-content"][data-state="open"]') ||
      document.querySelector('[role="listbox"][data-state="open"]') ||
      document.querySelector("[data-radix-select-content][data-state='open']") ||
      document.querySelector("[data-radix-popper-content-wrapper]"),
  );
}

export function shouldBlockOverlayDismiss(target?: EventTarget | null): boolean {
  return (
    isDismissGuardActive() ||
    hasOpenPortaledOverlay() ||
    (target != null && isPortaledOverlayTarget(target))
  );
}

export function preventDismissForPortaledOverlay(
  event: { preventDefault: () => void; target: EventTarget },
) {
  if (shouldBlockOverlayDismiss(event.target)) {
    event.preventDefault();
  }
}
