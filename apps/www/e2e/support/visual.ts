import { expect, type Locator, type Page } from "@playwright/test";
import { Duration, Effect } from "effect";
import { waitForStableCanvas } from "@/e2e/support/canvas";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { scrollToElement } from "@/e2e/support/input";
import {
  readCumulativeLayoutShift,
  readPageLayoutShift,
} from "@/e2e/support/layout";
import { LINE_SCENE } from "@/e2e/support/selector";
import { revealTimeoutMilliseconds } from "@/e2e/support/timeout";

/** How long one attempt of a retried check waits before the next one. */
const ATTEMPT_TIMEOUT_MILLISECONDS = 1000;
/** Readings of the session's layout shift that must agree before a step. */
const SETTLED_READINGS = 2;
const SETTLE_ATTEMPTS = 10;

/** The animated lab's scene, which names how many bacteria it draws. */
export const BACTERIA_SCENE = "[data-bacteria-count]";
/** The animated lab's generation option that names the start, such as "0 h". */
const FIRST_GENERATION = /^0\s/;

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
 * Opens a lesson and proves every visual card carries the full screen action.
 *
 * A server-rendered lesson belongs to React only once React commits its
 * hydration. Until then a provider above it that changes as the page starts,
 * such as the session finishing loading, can make React render the whole
 * lesson again on the client, and so can a press that reaches the lesson
 * first. Both replace every element a check has found. The key React puts on
 * an element does not show a commit, because React writes it while it renders
 * a hydration it can still drop. A check therefore presses or marks a card
 * only after the card shows a sign that only a committed tree gives: the lab's
 * autoplay, a scene's canvas, or a chart's plot, which the server never
 * renders.
 */
export const openVisualLesson = Effect.fn("NakafaE2E.openVisualLesson")(
  function* (page: Page, href: string, fullscreen: string) {
    yield* seedAnalyticsConsent(page, "denied");
    const response = yield* Effect.promise(() =>
      page.goto(href, { waitUntil: "domcontentloaded" })
    );
    yield* Effect.sync(() => expect(response?.ok()).toBe(true));
    yield* Effect.promise(() => page.waitForLoadState("networkidle"));
    const cards = page.locator('[data-slot="visual-card"]');
    // A card the server streamed can wait hidden beside the lesson React
    // renders, so each attempt counts the cards again.
    yield* Effect.promise(() =>
      expect(async () => {
        const count = await cards.count();
        expect(count).toBeGreaterThan(0);
        // Cards far from the viewport skip rendering but keep their controls.
        await expect(
          cards.getByRole("button", {
            exact: true,
            includeHidden: true,
            name: fullscreen,
          })
        ).toHaveCount(count, { timeout: ATTEMPT_TIMEOUT_MILLISECONDS });
      }).toPass({ timeout: revealTimeoutMilliseconds })
    );
  }
);

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
    }).toPass({ timeout: revealTimeoutMilliseconds })
  );
  return card;
});

/**
 * Reveals the animated lab and waits until its own autoplay has moved it past
 * its first generation. The server renders the first generation, and only a
 * committed React tree runs the effect that advances it, so from then on the
 * lab and the lesson around it are the elements React keeps. The lab advances
 * only while it is in view, so each attempt scrolls to it first.
 */
export const revealLab = Effect.fn("NakafaE2E.revealVisualLab")(function* (
  page: Page
) {
  const card = yield* revealCard(page, BACTERIA_SCENE);
  yield* Effect.promise(() =>
    expect(async () => {
      await scrollToElement(card, "start");
      await expect(
        card.getByRole("button", { name: FIRST_GENERATION, pressed: false })
      ).toBeVisible({ timeout: ATTEMPT_TIMEOUT_MILLISECONDS });
    }).toPass({ timeout: revealTimeoutMilliseconds })
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
    }).toPass({ timeout: revealTimeoutMilliseconds })
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
 * Reads a layout shift once it stops changing. Content below the fold can
 * still settle after load, so a session compares settled readings taken
 * around it.
 */
function settleLayoutShift(
  page: Page,
  read: (page: Page) => ReturnType<typeof readCumulativeLayoutShift>
) {
  return Effect.gen(function* () {
    const readings = [yield* read(page)];
    for (
      let attempt = 0;
      attempt < SETTLE_ATTEMPTS &&
      (readings.length < SETTLED_READINGS ||
        readings.at(-1) !== readings.at(-SETTLED_READINGS));
      attempt += 1
    ) {
      yield* Effect.sleep(Duration.millis(500));
      readings.push(yield* read(page));
    }
    return readings.at(-1) ?? 0;
  });
}

/** Reads the cumulative layout shift of the whole page once it stops changing. */
export const readSettledLayoutShift = Effect.fn(
  "NakafaE2E.readSettledVisualLayoutShift"
)((page: Page) => settleLayoutShift(page, readCumulativeLayoutShift));

/**
 * Reads the layout shift of the page around its visual cards once it stops
 * changing. The card's own contents move when it changes presentation, so
 * they are not the page's.
 */
export const readSettledPageShift = Effect.fn(
  "NakafaE2E.readSettledVisualPageShift"
)((page: Page) => settleLayoutShift(page, readPageLayoutShift));

/**
 * Expects the session since `before` to add no layout shift to the page around
 * the card that the learner did not cause: the card's slot holds the page
 * while the card is away.
 */
export const expectNoPageShift = Effect.fn("NakafaE2E.expectNoVisualPageShift")(
  function* (page: Page, before: number) {
    const after = yield* readSettledPageShift(page);
    yield* Effect.sync(() => expect(after).toBe(before));
  }
);

/**
 * Lets the animated lab grow through every generation without a press and
 * expects it to move nothing on the page: a count that gets wider, or the
 * option the growth reaches, would shift the layout with no input to explain
 * it. The lab stops at its last generation and offers `play`.
 */
export const expectLabStill = Effect.fn("NakafaE2E.expectVisualLabStill")(
  function* (page: Page, card: Locator, play: string) {
    const before = yield* readSettledLayoutShift(page);
    yield* Effect.promise(() =>
      expect(async () => {
        await scrollToElement(card, "start");
        await expect(
          card.getByRole("button", { exact: true, name: play })
        ).toBeVisible({ timeout: ATTEMPT_TIMEOUT_MILLISECONDS });
      }).toPass({ timeout: revealTimeoutMilliseconds })
    );
    const after = yield* readSettledLayoutShift(page);
    yield* Effect.sync(() => expect(after).toBe(before));
  }
);
