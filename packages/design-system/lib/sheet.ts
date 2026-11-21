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

/** The sheet that a sheet was opened from: the sheet or drawer holding the trigger that names it (`aria-controls`). */
function openerSheet(sheet: HTMLElement) {
  if (sheet.id === "") {
    return null;
  }
  const opener = sheet.ownerDocument.querySelector(
    `[aria-controls="${CSS.escape(sheet.id)}"]`
  );
  return (
    opener?.closest<HTMLElement>(
      '[data-presentation="sheet"], [data-slot="drawer-content"]'
    ) ?? null
  );
}

/**
 * Tells the sheet a sheet was opened from how tall the sheet in front stands, so the one behind steps back far enough
 * to keep its top edge in view above it, however much shorter it is (`sheetSurface`). A ref of the grip, the sheet's
 * first child, as `releaseSheetExit` is. The height is written on the sheet behind as `--sheet-front-height` while
 * the sheet in front is in the page, and as it resizes, and it is taken off as the sheet in front leaves.
 */
export function reportSheetHeight(grip: HTMLElement | null) {
  const sheet = grip?.parentElement;
  if (!sheet) {
    return;
  }
  let behind: HTMLElement | null = null;
  const observer = new ResizeObserver(() => {
    behind ??= openerSheet(sheet);
    behind?.style.setProperty(
      "--sheet-front-height",
      `${sheet.offsetHeight}px`
    );
  });
  observer.observe(sheet);
  return () => {
    observer.disconnect();
    behind?.style.removeProperty("--sheet-front-height");
  };
}

/** Every ref a sheet's grip carries: its exit after a swipe (`releaseSheetExit`) and its height (`reportSheetHeight`). */
export function attachSheetGrip(grip: HTMLElement | null) {
  const release = releaseSheetExit(grip);
  const report = reportSheetHeight(grip);
  return () => {
    release?.();
    report?.();
  };
}
