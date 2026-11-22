/**
 * When UI SDK presents a popup of `presentation="auto"` as a sheet: on a phone, a narrow screen with a coarse pointer,
 * as `createPresentation` in `@ui-sdk/core` resolves it as the popup opens.
 */
export const PHONE_SHEET = "(max-width: 640px) and (pointer: coarse)";

/**
 * Whether an animation follows a scroll timeline, as the ones that tie a sheet to its host's scroll do, rather than
 * the document's clock.
 */
function followsScroll(animation: Animation) {
  return animation.timeline !== null && "source" in animation.timeline;
}

/**
 * Lets a sheet that a swipe closed leave at once. A ref of its grip, the sheet's first child, so every popup that
 * rises as a sheet carries it. On a touch screen UI SDK moves a sheet by its host's scroll
 * (`data-driver="scroll-snap"`), with animations tied to that scroll, and a popup's exit waits for every animation
 * inside it to finish. One tied to a scroll never does: Chrome stops waiting after the exit's own duration, but
 * Firefox gives the scroll an end of 100,000 ms, so the exit, and the page that stays inert behind the sheet, would
 * wait 100 seconds after a swipe. As the exit starts (`data-ending-style`), the scroll-tied animations of every part
 * that leaves with it, the sheet and its backdrop, are cancelled. A swipe has carried the sheet out of sight and
 * cleared the backdrop by then, and a close by a button has already replaced them with its own motion, so nothing
 * they drew changes on screen. Upstream it is `whenFinished` in `@ui-sdk/core`'s
 * presence.
 */
export function releaseSheetExit(grip: HTMLElement | null) {
  const sheet = grip?.parentElement;
  if (!sheet) {
    return;
  }
  const observer = new MutationObserver(() => {
    if (!sheet.hasAttribute("data-ending-style")) {
      return;
    }
    for (const leaving of sheet.ownerDocument.querySelectorAll(
      "[data-ending-style]"
    )) {
      for (const animation of leaving.getAnimations({ subtree: true })) {
        if (followsScroll(animation)) {
          animation.cancel();
        }
      }
    }
  });
  observer.observe(sheet, { attributeFilter: ["data-ending-style"] });
  return () => observer.disconnect();
}
