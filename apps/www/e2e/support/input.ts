import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { Effect, Schema } from "effect";
import { waitForStill } from "@/e2e/support/quiet";

const ACTIVATION_PROBE_TIMEOUT_MILLISECONDS = 1000;

/** How a press reaches its control. Unset options keep Playwright's defaults. */
const PressOptionsSchema = Schema.Struct({
  /** Skips the wait for a navigation that the press starts. */
  noWaitAfter: Schema.optionalKey(Schema.Boolean),
  /** Where the press lands, in CSS pixels from the control's corner. */
  position: Schema.optionalKey(
    Schema.Struct({ x: Schema.Finite, y: Schema.Finite })
  ),
  /** How many milliseconds the press may take before it fails. */
  timeout: Schema.optionalKey(Schema.Finite),
});

type PressOptions = typeof PressOptionsSchema.Type;

/** Clicks or taps a control with the given options. */
export function press(
  control: Locator,
  hasTouch: boolean,
  options: PressOptions = {}
) {
  return hasTouch ? control.tap(options) : control.click(options);
}

/**
 * Activates a control. The press scrolls it into view and finds whichever element
 * stands, because a page's live variant can replace the visitor's at any moment.
 */
export const activate = Effect.fn("NakafaE2E.activateControl")(function* (
  control: Locator,
  hasTouch: boolean
) {
  yield* Effect.promise(() => press(control, hasTouch, { noWaitAfter: true }));
});

/** The first link to `href` that the page shows inside `scope`, such as `main`. */
export function visibleLink(page: Page, href: string, scope: string) {
  return page
    .locator(`${scope} a[href="${href}"]`)
    .filter({ visible: true })
    .first();
}

/** Repeats a real activation until its client-owned surface becomes visible. */
export const activateUntilVisible = Effect.fn("NakafaE2E.activateUntilVisible")(
  function* (trigger: Locator, surface: Locator, timeoutMilliseconds: number) {
    yield* Effect.promise(() =>
      expect(async () => {
        if (await surface.isVisible()) {
          return;
        }

        await trigger.click({ timeout: timeoutMilliseconds });
        await expect(surface).toBeVisible({
          timeout: ACTIVATION_PROBE_TIMEOUT_MILLISECONDS,
        });
      }).toPass({ intervals: [100], timeout: timeoutMilliseconds })
    );
    return surface;
  }
);

/**
 * Swipes a sheet down and away, the way a reader dismisses it on a touch screen. There the sheet stands in a host that
 * scrolls (UI SDK's scroll-snap driver, `data-driver="scroll-snap"`), and a swipe down scrolls the host to its top,
 * which carries the sheet out of sight. Playwright drives no touch scroll in every engine, so the host is scrolled
 * there as the swipe leaves it. The sheet must stand still first, since it slides up as it opens.
 */
export async function swipeAway(sheet: Locator) {
  await waitForStill(sheet);
  await expect(sheet).toHaveAttribute("data-driver", "scroll-snap");
  await sheet.evaluate((element) =>
    element.parentElement?.scrollTo({ top: 0 })
  );
}

/**
 * Scrolls the page until the element sits at `block` in the viewport, the way
 * the page's own scripts scroll. Playwright's scroll into view left a card just
 * below the fold out of view in WebKit on Linux, and a smooth scroll races a
 * pointer action into the sticky header, so no suite relies on either.
 */
export function scrollToElement(
  locator: Locator,
  block: ScrollLogicalPosition
) {
  return locator.evaluate(
    (element, position) =>
      element.scrollIntoView({ behavior: "instant", block: position }),
    block
  );
}

/** Moves the pointer to the middle of `target` in small steps, as a reader's hand does, so every element on the way sees it. */
export const movePointerTo = Effect.fn("NakafaE2E.movePointerTo")(function* (
  page: Page,
  target: Locator
) {
  const box = yield* Effect.promise(() => target.boundingBox());
  expect(box, "the pointer's target is on the page").not.toBeNull();
  if (box === null) {
    return;
  }
  yield* Effect.promise(() =>
    page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
      steps: 12,
    })
  );
});
