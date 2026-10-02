import { expect, type Locator, type Page } from "@playwright/test";
import { Duration, Effect } from "effect";
import { waitForStableCanvas } from "@/e2e/support/canvas";
import { seedDeniedAnalyticsConsent } from "@/e2e/support/consent";
import { readCumulativeLayoutShift } from "@/e2e/support/layout";

const REVEAL_TIMEOUT_MILLISECONDS = 30_000;
/** Readings of the session's layout shift that must agree before a step. */
const SETTLED_READINGS = 2;
const SETTLE_ATTEMPTS = 10;

/** The animated lab's scene, which names how many bacteria it draws. */
export const BACTERIA_SCENE = "[data-bacteria-count]";
/** A deferred 3D line scene of a lesson card. */
export const LINE_SCENE = '[data-slot="line-scene"]';

/** Hides the Fullscreen API the way iPhone Safari does for everything but video. */
export function hideFullscreenApi() {
  Object.defineProperty(Document.prototype, "fullscreenEnabled", {
    configurable: true,
    get: () => false,
  });
}

/** Removes popovers the way Safari before version 17 lacks them. */
export function hidePopoverApi() {
  Reflect.deleteProperty(HTMLElement.prototype, "showPopover");
}

/**
 * Waits until React owns every visual card of the lesson. Until React has
 * hydrated a server-rendered lesson, a provider above it that changes as the
 * page starts, such as the session finishing loading, can make React render
 * the whole lesson again on the client, which replaces every element a check
 * has found, and a streamed copy of the lesson can wait hidden beside it.
 * React keys each element it hydrates or creates to its own instance and
 * never replaces those.
 */
function expectCardsOwnedByReact(cards: Locator) {
  return expect
    .poll(
      () =>
        cards.evaluateAll(
          (elements) =>
            elements.length > 0 &&
            elements.every((element) =>
              Reflect.ownKeys(element).some(
                (key) =>
                  typeof key === "string" && key.startsWith("__reactFiber$")
              )
            )
        ),
      { timeout: REVEAL_TIMEOUT_MILLISECONDS }
    )
    .toBe(true);
}

/**
 * Opens a lesson, waits until React owns its visual cards, and proves every
 * card carries the full screen action.
 */
export const openVisualLesson = Effect.fn("NakafaE2E.openVisualLesson")(
  function* (page: Page, href: string, fullscreen: string) {
    yield* seedDeniedAnalyticsConsent(page);
    const response = yield* Effect.promise(() =>
      page.goto(href, { waitUntil: "domcontentloaded" })
    );
    yield* Effect.sync(() => expect(response?.ok()).toBe(true));
    yield* Effect.promise(() => page.waitForLoadState("networkidle"));
    const cards = page.locator('[data-slot="visual-card"]');
    yield* Effect.promise(() => expectCardsOwnedByReact(cards));
    const count = yield* Effect.promise(() => cards.count());
    yield* Effect.promise(async () => {
      expect(count).toBeGreaterThan(0);
      // Cards far from the viewport skip rendering but keep their controls.
      await expect(
        cards.getByRole("button", {
          exact: true,
          includeHidden: true,
          name: fullscreen,
        })
      ).toHaveCount(count);
    });
  }
);

/**
 * Scrolls the page until the element sits at `block` in the viewport, the way
 * the page's own scripts scroll. Playwright's scroll into view left a card
 * just below the fold out of view in WebKit on Linux, so no reveal relies on
 * it.
 */
function scrollToElement(locator: Locator, block: ScrollLogicalPosition) {
  return locator.evaluate(
    (element, position) =>
      element.scrollIntoView({ behavior: "instant", block: position }),
    block
  );
}

/** Scrolls to the visual card that holds `content`, the first by default. */
export const revealCard = Effect.fn("NakafaE2E.revealVisualCard")(function* (
  page: Page,
  content: string,
  index = 0
) {
  const card = page
    .locator('[data-slot="visual-card"] > [data-slot="card"]')
    .filter({ has: page.locator(content) })
    .nth(index);
  // A content-visibility card lays out its content only near the viewport.
  yield* Effect.promise(() =>
    expect(async () => {
      await scrollToElement(card, "start");
      await expect(card.locator(content).first()).toBeVisible();
    }).toPass({ timeout: REVEAL_TIMEOUT_MILLISECONDS })
  );
  return card;
});

/** Reveals a card's deferred 3D scene and waits for its canvas to settle. */
export const revealScene = Effect.fn("NakafaE2E.revealVisualScene")(function* (
  page: Page,
  index = 0
) {
  const card = yield* revealCard(page, LINE_SCENE, index);
  const canvas = card.locator(`${LINE_SCENE} canvas`);
  yield* Effect.promise(() =>
    expect(async () => {
      await scrollToElement(card.locator(LINE_SCENE), "start");
      expect(await canvas.isVisible()).toBe(true);
    }).toPass({ timeout: REVEAL_TIMEOUT_MILLISECONDS })
  );
  yield* waitForStableCanvas(canvas);
  return { canvas, card };
});

/**
 * Centers the card's action in the viewport, clear of the sticky bar at the
 * bottom of a phone screen, so clicking it scrolls nothing, and returns it.
 */
export const revealAction = Effect.fn("NakafaE2E.revealVisualAction")(
  function* (card: Locator, fullscreen: string) {
    const action = card.getByRole("button", { exact: true, name: fullscreen });
    yield* Effect.promise(() => scrollToElement(action, "center"));
    return action;
  }
);

/** Reads where the card's slot and the lesson around it sit in the page. */
export function readPlacement(card: Locator) {
  return card.evaluate((element) => ({
    article: element.closest("article")?.getBoundingClientRect().height,
    scrollY: window.scrollY,
    slot: element
      .closest('[data-slot="visual-card"]')
      ?.getBoundingClientRect()
      .toJSON(),
  }));
}

/**
 * Reads how the card is presented. A card that fills the screen covers the
 * viewport edge to edge, also where the root reserves scrollbar gutters, such
 * as on Linux and Windows. It is the topmost element at every corner and at
 * its footer, and its footer sits at the bottom because the scene took the
 * free height, so the card never scrolls. The page behind is inert when every
 * link and button outside the card sits in an inert subtree.
 */
export function readPresentation(card: Locator) {
  return card.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const footer = element.querySelector('[data-slot="card-footer"]');
    const paddingBottom = Number.parseFloat(
      getComputedStyle(element).paddingBottom
    );
    const footerGap =
      bounds.bottom -
      paddingBottom -
      (footer?.getBoundingClientRect().bottom ?? 0);
    const outside = Array.from(
      document.querySelectorAll("a[href], button")
    ).filter((control) => !element.contains(control));
    const footerBounds = footer?.getBoundingClientRect();
    // The corners, and the footer where a phone's sticky bar would sit.
    const probes = [
      [2, 2],
      [window.innerWidth - 3, 2],
      [2, window.innerHeight - 3],
      [window.innerWidth - 3, window.innerHeight - 3],
      ...(footerBounds
        ? [
            [
              footerBounds.left + footerBounds.width / 2,
              footerBounds.top + footerBounds.height / 2,
            ],
          ]
        : []),
    ];
    return {
      covers:
        bounds.left === 0 &&
        bounds.top === 0 &&
        bounds.width === window.innerWidth &&
        bounds.height === window.innerHeight,
      fills:
        Math.abs(footerGap) <= 1 &&
        element.scrollHeight <= element.clientHeight,
      focusInside: element.contains(document.activeElement),
      fullscreen: document.fullscreenElement === element,
      pageInert:
        outside.length > 0 &&
        outside.every((control) => control.closest("[inert]") !== null),
      position: getComputedStyle(element).position,
      scrollLocked: document.documentElement.style.overflow === "hidden",
      topmost:
        footerBounds !== undefined &&
        probes.every(([x, y]) =>
          element.contains(document.elementFromPoint(x, y))
        ),
    };
  });
}

/** Reads the height of the card's scene frame. */
export function readSceneHeight(card: Locator) {
  return card
    .locator('[data-slot="visual-card-scene"]')
    .first()
    .evaluate((element) => element.getBoundingClientRect().height);
}

/** Expects the card back in its slot, with focus on its action. */
export const expectReturned = Effect.fn("NakafaE2E.expectVisualReturned")(
  function* (
    card: Locator,
    action: Locator,
    placement: Awaited<ReturnType<typeof readPlacement>>
  ) {
    yield* Effect.promise(async () => {
      await expect(action).toHaveAttribute("aria-pressed", "false");
      await expect(action).toBeFocused();
      await expect
        .poll(() => readPresentation(card))
        .toMatchObject({
          fullscreen: false,
          pageInert: false,
          position: "static",
          scrollLocked: false,
        });
      expect(await readPlacement(card)).toEqual(placement);
    });
  }
);

/**
 * Reads the page's cumulative layout shift once it stops changing. Content
 * below the fold can still settle after load, so a session compares settled
 * readings taken around it.
 */
export const readSettledLayoutShift = Effect.fn(
  "NakafaE2E.readSettledVisualLayoutShift"
)(function* (page: Page) {
  const readings = [yield* readCumulativeLayoutShift(page)];
  for (
    let attempt = 0;
    attempt < SETTLE_ATTEMPTS &&
    (readings.length < SETTLED_READINGS ||
      readings.at(-1) !== readings.at(-SETTLED_READINGS));
    attempt += 1
  ) {
    yield* Effect.sleep(Duration.millis(500));
    readings.push(yield* readCumulativeLayoutShift(page));
  }
  return readings.at(-1) ?? 0;
});

/**
 * Expects the session since `before` to add no layout shift the learner did
 * not cause: the card's slot holds the page while the card is away.
 */
export const expectNoLayoutShift = Effect.fn(
  "NakafaE2E.expectNoVisualLayoutShift"
)(function* (page: Page, before: number) {
  const after = yield* readSettledLayoutShift(page);
  yield* Effect.sync(() => expect(after).toBe(before));
});
