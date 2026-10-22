/**
 * Prevents pinch-to-zoom on the app itself.
 *
 * Requested deliberately: the layout is built for the phone's own width and
 * zooming it out just makes the app unreadable rather than revealing anything.
 *
 * Three parts are needed, because no single one covers every browser:
 *
 *   1. `user-scalable=no, maximum-scale=1` in the viewport meta — honoured by
 *      Android Chrome and Firefox.
 *   2. `touch-action: pan-x pan-y` on <html> in the stylesheet — the
 *      standards-based way to say "panning yes, zooming no".
 *   3. The listeners below — iOS Safari has ignored the viewport meta since
 *      iOS 10 and only stops on its own non-standard `gesture*` events.
 *
 * WHAT THIS COSTS: people who pinch to read small text can no longer do so.
 * That is why inputs are 16px (see index.css) — so nothing ever needs zooming
 * in to read or type. Vehicle photos are unaffected: the detail gallery opens
 * them in a new browser tab, which has its own normal zoom.
 *
 * TO UNDO: delete the call in main.tsx, the `touch-action` line on html, and
 * `maximum-scale=1, user-scalable=no` from the viewport meta in index.html.
 */

/** Safari-only, and not in lib.dom — hence the cast at the call site. */
const SAFARI_GESTURE_EVENTS = ['gesturestart', 'gesturechange', 'gestureend'] as const

export function lockZoom() {
  const block = (event: Event) => event.preventDefault()

  for (const name of SAFARI_GESTURE_EVENTS) {
    document.addEventListener(name as unknown as keyof DocumentEventMap, block, {
      passive: false,
    })
  }

  // Deliberately no `touchmove` listener. Cancelling pinch there would have to
  // be non-passive, which makes the browser wait on every single scroll to see
  // whether it will be cancelled — a real frame cost on every swipe. Android
  // and desktop Chrome are already covered by the viewport meta and
  // `touch-action`, so the cost would buy nothing.

  return () => {
    for (const name of SAFARI_GESTURE_EVENTS) {
      document.removeEventListener(name as unknown as keyof DocumentEventMap, block)
    }
  }
}
