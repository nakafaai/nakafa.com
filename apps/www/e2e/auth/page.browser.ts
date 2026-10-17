import { expect, type Locator, type Page, test } from "@playwright/test";
import { COVER } from "@repo/design-system/components/pool/cover";
import { Array as Arr, Duration, Effect, MutableList, Schema } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

const SIGN_IN = "/en/auth";
/** The pool, and each of its members as the frame loop places them. */
const POOL = '[data-slot="pool"]';
const MEMBERS = `${POOL} > div`;
/** The column that holds the pool on wide screens, and is not displayed on a phone. */
const ARTWORK = '[data-slot="entry-artwork"]';
/** The sign-in page's title, sentence, button and consent, in English. */
const TITLE = "Sign in to Nakafa";
const SENTENCE = "So your progress stays saved.";
const GOOGLE = "Continue with Google";
const CONSENT =
  "By signing in, you agree to the Terms of Service and the Privacy Policy.";
/** Nina is drawn this many pixels wide beside the title. */
const NINA = 'svg[width="190"]';
/** Two reads this far apart show whether the pool still moves, in milliseconds. */
const READS_APART_MILLISECONDS = 500;
/** A member may reach this far past the column's edge, in pixels, from rounding alone. */
const EDGE_SLACK = 0.5;
/** A drag ends this far to the left of the column, in pixels. */
const DRAG_PAST = 200;
/** A pointer crossing starts and ends this far inside the column, in pixels. */
const CROSSING_INSET = 4;
/** A pointer crossing moves in this many parts, so the pool sees the pointer move. */
const CROSSING_STEPS = 60;
/** The share of the pool's height that a pointer crossing runs along. */
const CROSSING_HEIGHT = 0.6;
/** The margin around the cover that the pool's unit test allows, for the sizes that are left over. */
const COVER_MARGIN = 0.02;
/** The spacing of the grid that the covered share is read on, in pixels. */
const GRID_PIXELS = 4;
/** The height of the screen that must show the whole sign-in page. */
const SHORT_SCREEN = 640;
/** The pool's own code writes this attribute on its element, and no other script does. */
const POOL_SCRIPT = /["']data-slot["']\s*:\s*["']pool["']/u;

/** A box on the screen, in pixels. */
const BoxSchema = Schema.Struct({
  height: Schema.Finite,
  width: Schema.Finite,
  x: Schema.Finite,
  y: Schema.Finite,
});

type Box = typeof BoxSchema.Type;

/** The box that a locator's element takes on the screen. */
function boxOf(locator: Locator): Promise<Box> {
  return locator.evaluate((node) => {
    const { height, width, x, y } = node.getBoundingClientRect();
    return { height, width, x, y };
  });
}

/**
 * The box of every member, in the order the pool draws them. A member is turned
 * a little while it moves, so its box is its size around its center, which a turn
 * leaves in place. The size is the one that the pool writes on the member.
 */
function memberBoxes(page: Page): Promise<readonly Box[]> {
  return page.locator(MEMBERS).evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      const size = Number.parseFloat(node.style.width);
      return {
        height: size,
        width: size,
        x: rect.x + rect.width / 2 - size / 2,
        y: rect.y + rect.height / 2 - size / 2,
      };
    })
  );
}

/** The transform that the frame loop last wrote to each member. */
function transformsOf(page: Page): Promise<readonly string[]> {
  return page
    .locator(MEMBERS)
    .evaluateAll((nodes) => nodes.map((node) => node.style.transform));
}

/**
 * The share of the pool's box that the members cover, read on a grid of points. A
 * member covers a disc of half its width around its center, as the physics has it.
 */
function coveredShare(page: Page): Promise<number> {
  return page.locator(POOL).evaluate((pool, step) => {
    const origin = pool.getBoundingClientRect();
    const discs = Array.from(
      pool.querySelectorAll<HTMLElement>(":scope > div"),
      (node) => {
        const rect = node.getBoundingClientRect();
        return {
          r: node.offsetWidth / 2,
          x: rect.x + rect.width / 2 - origin.x,
          y: rect.y + rect.height / 2 - origin.y,
        };
      }
    );
    let covered = 0;
    let total = 0;
    for (let y = step / 2; y < origin.height; y += step) {
      for (let x = step / 2; x < origin.width; x += step) {
        total += 1;
        if (
          discs.some(
            (disc) => (x - disc.x) ** 2 + (y - disc.y) ** 2 <= disc.r ** 2
          )
        ) {
          covered += 1;
        }
      }
    }
    return covered / total;
  }, GRID_PIXELS);
}

/** The center of the member that lies lowest on the screen. */
async function lowestCenter(page: Page) {
  const members = await memberBoxes(page);
  const lowest = Arr.reduce(members, members[0], (low, member) =>
    member.y > low.y ? member : low
  );
  return {
    x: lowest.x + lowest.width / 2,
    y: lowest.y + lowest.height / 2,
  };
}

/** Expects every member to lie inside the column, within the slack for rounding. */
function expectInside(members: readonly Box[], column: Box) {
  Arr.forEach(members, (member, index) => {
    expect(
      member.x,
      `member ${index} starts left of the column`
    ).toBeGreaterThanOrEqual(column.x - EDGE_SLACK);
    expect(
      member.y,
      `member ${index} starts above the column`
    ).toBeGreaterThanOrEqual(column.y - EDGE_SLACK);
    expect(
      member.x + member.width,
      `member ${index} ends right of the column`
    ).toBeLessThanOrEqual(column.x + column.width + EDGE_SLACK);
    expect(
      member.y + member.height,
      `member ${index} ends below the column`
    ).toBeLessThanOrEqual(column.y + column.height + EDGE_SLACK);
  });
}

/** Waits until the pool has drawn its members, and each of them has its place. */
const waitForPlaced = Effect.fn("NakafaE2E.waitForPoolPlaced")(function* (
  page: Page
) {
  yield* Effect.promise(() =>
    expect(async () => {
      const placed = await transformsOf(page);
      expect(placed.length).toBeGreaterThan(0);
      expect(Arr.every(placed, (transform) => transform !== "")).toBe(true);
    }).toPass({ timeout: readinessTimeoutMilliseconds })
  );
});

/**
 * Waits until the pool stands still: its members are placed, and two reads a
 * moment apart give the same transforms.
 */
const waitForRest = Effect.fn("NakafaE2E.waitForPoolRest")(function* (
  page: Page
) {
  yield* Effect.promise(() =>
    expect(async () => {
      const first = await transformsOf(page);
      expect(first.length).toBeGreaterThan(0);
      expect(Arr.every(first, (transform) => transform !== "")).toBe(true);
      await page.waitForTimeout(READS_APART_MILLISECONDS);
      expect(await transformsOf(page)).toEqual(first);
    }).toPass({ timeout: readinessTimeoutMilliseconds })
  );
});

/** Opens the sign-in page with analytics consent answered, so no prompt covers it. */
const openSignIn = Effect.fn("NakafaE2E.openSignIn")(function* (page: Page) {
  yield* seedAnalyticsConsent(page, "denied");
  yield* Effect.promise(() => page.goto(SIGN_IN));
});

/**
 * Starts recording the text of each script that the app itself loads. The pool's
 * code is one of those chunks, so a chunk that cannot be read fails the check
 * instead of passing it as an empty script.
 */
function watchScripts(page: Page) {
  const texts = MutableList.make<Promise<string>>();
  page.on("response", (response) => {
    const { pathname } = new URL(response.url());
    if (
      response.request().resourceType() === "script" &&
      pathname.startsWith("/_next/static/")
    ) {
      const text = response.text();
      // The failure stays on the promise, and reaches the check that awaits it.
      text.catch(() => undefined);
      MutableList.append(texts, text);
    }
  });
  return texts;
}

/** Whether any recorded script holds the code of the pool. */
function holdsPool(texts: MutableList.MutableList<Promise<string>>) {
  return Effect.map(
    Effect.promise(() => Promise.all(MutableList.toArray(texts))),
    (bodies) => Arr.some(bodies, (body) => POOL_SCRIPT.test(body))
  );
}

/** Expects the members at rest to cover about half of the pool, and to lie inside its column. */
const verifyRestCover = Effect.fn("NakafaE2E.verifyPoolCoversHalf")(function* (
  page: Page
) {
  const texts = watchScripts(page);
  yield* openSignIn(page);
  yield* waitForRest(page);
  const share = yield* Effect.promise(() => coveredShare(page));
  expect(Math.abs(share - COVER)).toBeLessThanOrEqual(COVER_MARGIN);
  const column = yield* Effect.promise(() => boxOf(page.locator(POOL)));
  const members = yield* Effect.promise(() => memberBoxes(page));
  yield* Effect.sync(() => expectInside(members, column));
  expect(yield* holdsPool(texts)).toBe(true);
});

const verifyDragOut = Effect.fn("NakafaE2E.verifyPoolDragOut")(function* (
  page: Page
) {
  yield* openSignIn(page);
  yield* waitForRest(page);
  const column = yield* Effect.promise(() => boxOf(page.locator(POOL)));
  const grip = yield* Effect.promise(() => lowestCenter(page));
  const before = yield* Effect.promise(() => transformsOf(page));
  yield* Effect.promise(async () => {
    await page.mouse.move(grip.x, grip.y);
    await page.mouse.down();
    await page.mouse.move(column.x - DRAG_PAST, column.y + column.height / 2, {
      steps: 20,
    });
  });
  // While the pointer holds the member, the pile changes under it.
  expect(yield* Effect.promise(() => transformsOf(page))).not.toEqual(before);
  yield* Effect.promise(() => page.mouse.up());
  yield* waitForRest(page);
  const members = yield* Effect.promise(() => memberBoxes(page));
  yield* Effect.sync(() => expectInside(members, column));
});

/** Moves the pointer across the middle of the pool, from its left edge to its right edge. */
const crossPool = Effect.fn("NakafaE2E.crossPool")(function* (page: Page) {
  const column = yield* Effect.promise(() => boxOf(page.locator(POOL)));
  const y = column.y + column.height * CROSSING_HEIGHT;
  yield* Effect.promise(async () => {
    await page.mouse.move(column.x + CROSSING_INSET, y);
    await page.mouse.move(column.x + column.width - CROSSING_INSET, y, {
      steps: CROSSING_STEPS,
    });
  });
  return column;
});

const verifyPointerCrossing = Effect.fn("NakafaE2E.verifyPoolCrossed")(
  function* (page: Page) {
    yield* openSignIn(page);
    yield* waitForRest(page);
    const before = yield* Effect.promise(() => transformsOf(page));
    const column = yield* crossPool(page);
    // While the pointer crosses, the animals it passes move.
    expect(yield* Effect.promise(() => transformsOf(page))).not.toEqual(before);
    yield* waitForRest(page);
    const members = yield* Effect.promise(() => memberBoxes(page));
    yield* Effect.sync(() => expectInside(members, column));
  }
);

const verifyWithoutScrolling = Effect.fn("NakafaE2E.verifySignInFits")(
  function* (page: Page) {
    yield* openSignIn(page);
    const shown = [
      page.locator(NINA),
      page.getByRole("heading", { level: 1, name: TITLE }),
      page.getByText(SENTENCE),
      page.getByRole("button", { name: GOOGLE }),
      page.getByText(CONSENT),
    ];
    yield* Effect.forEach(shown, (locator) =>
      Effect.promise(() => expect(locator).toBeVisible())
    );
    const bottoms = yield* Effect.forEach(shown, (locator) =>
      Effect.map(
        Effect.promise(() => boxOf(locator)),
        (box) => box.y + box.height
      )
    );
    yield* Effect.sync(() =>
      Arr.forEach(bottoms, (bottom) =>
        expect(bottom).toBeLessThanOrEqual(SHORT_SCREEN)
      )
    );
    const scrolls = yield* Effect.promise(() =>
      page.evaluate(() => {
        const column = document.querySelector("main")?.firstElementChild;
        return (
          document.documentElement.scrollHeight <= window.innerHeight &&
          column !== undefined &&
          column !== null &&
          column.scrollHeight <= column.clientHeight
        );
      })
    );
    expect(scrolls).toBe(true);
  }
);

const verifyStill = Effect.fn("NakafaE2E.verifyPoolStillWithReducedMotion")(
  function* (page: Page) {
    yield* openSignIn(page);
    yield* waitForPlaced(page);
    const first = yield* Effect.promise(() => transformsOf(page));
    yield* Effect.sleep(Duration.millis(READS_APART_MILLISECONDS));
    expect(yield* Effect.promise(() => transformsOf(page))).toEqual(first);
  }
);

const verifyPointerIgnored = Effect.fn("NakafaE2E.verifyPoolIgnoresPointer")(
  function* (page: Page) {
    yield* openSignIn(page);
    yield* waitForPlaced(page);
    const before = yield* Effect.promise(() => transformsOf(page));
    yield* crossPool(page);
    expect(yield* Effect.promise(() => transformsOf(page))).toEqual(before);
  }
);

const verifyPhone = Effect.fn("NakafaE2E.verifySignInOnAPhone")(function* (
  page: Page
) {
  const texts = watchScripts(page);
  yield* openSignIn(page);
  yield* Effect.promise(() => page.waitForLoadState("networkidle"));
  yield* Effect.promise(() => expect(page.locator(ARTWORK)).toHaveCount(1));
  yield* Effect.promise(() => expect(page.locator(ARTWORK)).toBeHidden());
  expect(yield* holdsPool(texts)).toBe(false);
});

test.describe("the animal pool beside the sign-in form at 1440 by 900", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("covers about half of the pool at rest, and each member lies inside the column", async ({
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyRestCover(page))
    );
  });

  test("a member released outside the column comes to rest inside it", async ({
    page,
  }) => {
    await Effect.runPromise(withObservedPageErrors(page, verifyDragOut(page)));
  });

  test("moves the animals a pointer crosses, and they stay inside the column", async ({
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyPointerCrossing(page))
    );
  });
});

test.describe("the animal pool beside the sign-in form at 2560 by 1440", () => {
  test.use({ viewport: { height: 1440, width: 2560 } });

  // The catalog is too small to cover half of this pool at the animals' own size, so the animals grow.
  test("covers about half of the wide pool at rest", async ({ page }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyRestCover(page))
    );
  });
});

test.describe("the sign-in page at 1440 by 640", () => {
  test.use({ viewport: { height: 640, width: 1440 } });

  test("shows Nina, the title, the sentence, the button and the consent without scrolling", async ({
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyWithoutScrolling(page))
    );
  });
});

test.describe("the animal pool with reduced motion", () => {
  test.use({ reducedMotion: "reduce", viewport: { height: 900, width: 1440 } });

  test("its members stay where they are once they are placed", async ({
    page,
  }) => {
    await Effect.runPromise(withObservedPageErrors(page, verifyStill(page)));
  });

  test("a pointer that crosses the pool moves none of its members", async ({
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyPointerIgnored(page))
    );
  });
});

test.describe("the sign-in page on a phone", () => {
  test.use({ viewport: { height: 844, width: 390 } });

  test("hides the column, and no script of the pool loads", async ({
    page,
  }) => {
    await Effect.runPromise(withObservedPageErrors(page, verifyPhone(page)));
  });
});
