import { expect, type Locator, type Page, test } from "@playwright/test";
import { Array as Arr, Duration, Effect, MutableList, Schema } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

const SIGN_IN = "/en/auth";
/** The pool, and each of its members as the frame loop places them. */
const POOL = '[data-slot="pool"]';
const MEMBERS = `${POOL} > div`;
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

/** The box of every member, in the order the pool draws them. */
function memberBoxes(page: Page): Promise<readonly Box[]> {
  return page.locator(MEMBERS).evaluateAll((nodes) =>
    nodes.map((node) => {
      const { height, width, x, y } = node.getBoundingClientRect();
      return { height, width, x, y };
    })
  );
}

/** The transform that the frame loop last wrote to each member. */
function transformsOf(page: Page): Promise<readonly string[]> {
  return page
    .locator(MEMBERS)
    .evaluateAll((nodes) => nodes.map((node) => node.style.transform));
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

/** Starts recording the text of every script that the page loads. */
function watchScripts(page: Page) {
  const texts = MutableList.make<Promise<string>>();
  page.on("response", (response) => {
    if (response.request().resourceType() === "script") {
      MutableList.append(
        texts,
        response.text().catch(() => "")
      );
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

const verifyRestInside = Effect.fn("NakafaE2E.verifyPoolRestsInside")(
  function* (page: Page) {
    const texts = watchScripts(page);
    yield* openSignIn(page);
    yield* Effect.promise(() => expect(page.locator(MEMBERS)).toHaveCount(30));
    yield* waitForRest(page);
    const column = yield* Effect.promise(() => boxOf(page.locator(POOL)));
    const members = yield* Effect.promise(() => memberBoxes(page));
    yield* Effect.sync(() => expectInside(members, column));
    expect(yield* holdsPool(texts)).toBe(true);
  }
);

const verifyDragOut = Effect.fn("NakafaE2E.verifyPoolDragOut")(function* (
  page: Page
) {
  yield* openSignIn(page);
  yield* Effect.promise(() => expect(page.locator(MEMBERS)).toHaveCount(30));
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
    yield* Effect.promise(() =>
      expect(async () => {
        const placed = await transformsOf(page);
        expect(Arr.every(placed, (transform) => transform !== "")).toBe(true);
      }).toPass({ timeout: readinessTimeoutMilliseconds })
    );
    const first = yield* Effect.promise(() => transformsOf(page));
    yield* Effect.sleep(Duration.millis(READS_APART_MILLISECONDS));
    expect(yield* Effect.promise(() => transformsOf(page))).toEqual(first);
  }
);

const verifyPhone = Effect.fn("NakafaE2E.verifySignInOnAPhone")(function* (
  page: Page
) {
  const texts = watchScripts(page);
  yield* openSignIn(page);
  yield* Effect.promise(() => page.waitForLoadState("networkidle"));
  yield* Effect.promise(() => expect(page.locator(POOL)).toBeHidden());
  expect(yield* holdsPool(texts)).toBe(false);
});

test.describe("the animal pool beside the sign-in form at 1440 by 900", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("holds thirty members, and at rest each one lies inside the column", async ({
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyRestInside(page))
    );
  });

  test("a member released outside the column comes to rest inside it", async ({
    page,
  }) => {
    await Effect.runPromise(withObservedPageErrors(page, verifyDragOut(page)));
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
});

test.describe("the sign-in page on a phone", () => {
  test.use({ viewport: { height: 844, width: 390 } });

  test("hides the column, and no script of the pool loads", async ({
    page,
  }) => {
    await Effect.runPromise(withObservedPageErrors(page, verifyPhone(page)));
  });
});
