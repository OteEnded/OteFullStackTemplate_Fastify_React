// Outside / backdrop dismissal that does NOT fire on a drag (EAP lib/overlay.ts).
//
// THE BUG THIS PREVENTS (Ote, 2026-08-03): `onClick={onClose}` on a backdrop closes the
// overlay when a press STARTS inside and ENDS outside (select text, drift past the edge →
// edits lost), because `click` fires on the common ancestor. Oteracount's Modal regressed to
// exactly that. THE RULE: dismiss only when the gesture STARTS and ENDS outside, and never
// on a secondary button (right-click).

/**
 * For popups with no backdrop element (drawers, custom panels). Call from an effect while
 * open; returns the cleanup. `isInside` should include the trigger so it can toggle.
 */
export function attachOutsideDismiss(isInside: (target: Node) => boolean, onClose: () => void) {
  let downOutside = false
  const onDown = (e: PointerEvent) => {
    downOutside = e.button === 0 && !isInside(e.target as Node)
  }
  const onUp = (e: PointerEvent) => {
    const dismiss = downOutside && e.button === 0 && !isInside(e.target as Node)
    downOutside = false // a release anywhere ends the gesture
    if (dismiss) onClose()
  }
  document.addEventListener('pointerdown', onDown)
  document.addEventListener('pointerup', onUp)
  return () => {
    document.removeEventListener('pointerdown', onDown)
    document.removeEventListener('pointerup', onUp)
  }
}

// Module-level on purpose: a pointer gesture is globally singular (one press in flight), and
// keeping it outside React means a re-render between press and release can't lose it.
let armed: EventTarget | null = null

/**
 * For an element whose OWN area is the backdrop — a native <dialog> (its ::backdrop hit-tests
 * as the dialog element) or a scrim <div>. Replaces `onClick={onClose}`:
 *   onPointerDown={backdropPointerDown}
 *   onPointerUp={(e) => backdropPointerUp(e) && onClose()}
 */
export function backdropPointerDown(e: React.PointerEvent) {
  armed = e.target === e.currentTarget && e.button === 0 ? e.currentTarget : null
}

/** True when this release completes a press that also started on the backdrop. */
export function backdropPointerUp(e: React.PointerEvent): boolean {
  const dismiss = armed === e.currentTarget && e.target === e.currentTarget && e.button === 0
  armed = null // a release anywhere ends the gesture
  return dismiss
}

// ── Who opened it? ──────────────────────────────────────────────────────────────────────────────
// Safari (WebKit) does NOT focus a button when it is clicked: focus goes to the nearest focusable
// ANCESTOR instead (here <main tabindex=-1>, or <body>), so "return focus to the opener" landed on
// <main> (found by the WebKit UI drive, 2026-11-02 — a focus-event probe showed it). Remember the
// last control pressed and prefer it when the focused element merely CONTAINS it.
const CONTROL = 'button, a[href], [role="button"], [role="menuitem"], input, select, textarea, [tabindex]'
let lastPressed: HTMLElement | null = null
if (typeof document !== 'undefined') {
  document.addEventListener(
    'pointerdown',
    (e) => {
      lastPressed = (e.target as Element | null)?.closest<HTMLElement>(CONTROL) ?? null
    },
    { capture: true },
  )
}

/** The element to return focus to when an overlay closes: the focused one, else the last control pressed. */
export function openerElement(): HTMLElement | null {
  const active = document.activeElement as HTMLElement | null
  const pressed = lastPressed?.isConnected ? lastPressed : null
  // Safari: the focused element is an ancestor of what was actually pressed → the pressed control.
  if (pressed && (!active || active === document.body || (active !== pressed && active.contains(pressed)))) return pressed
  return active && active !== document.body ? active : null
}
