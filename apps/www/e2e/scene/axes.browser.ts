import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { Array as Arr, Effect, Order, Schema } from "effect";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { openRoute } from "@/e2e/support/route";
import { revealLineScene } from "@/e2e/support/scene";
import {
  MATH_SCENE,
  mathSceneCards,
  paginationNavigation,
  SUBJECT_LINK,
} from "@/e2e/support/selector";
import { revealTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The axes that a line scene labels, in the order its coordinate system draws them. */
const AXIS_NAMES = ["X", "Y", "Z"];

/** Reads the names that the axis labels of one scene carry, in DOM order. */
function readAxisNames(scene: Locator) {
  return scene
    .locator("[data-axis-label]")
    .evaluateAll((labels) =>
      labels.map((label) => label.getAttribute("data-axis-label"))
    );
}

/**
 * Opens the pinned lesson and waits until its first 3D scene labels the X, Y,
 * and Z axes. The card sets no showZAxis, so the scene keeps its default Z axis.
 */
const mountAxisLabels = Effect.fn("NakafaE2E.mountAxisLabels")(function* (
  page: Page
) {
  yield* openRoute(page, pinnedRoutes.material.en);
  const card = mathSceneCards(page).first();
  const scene = card.locator(MATH_SCENE);
  yield* revealLineScene(card);
  yield* Effect.promise(() =>
    expect(async () => {
      expect(await readAxisNames(scene)).toEqual(AXIS_NAMES);
    }).toPass({ timeout: revealTimeoutMilliseconds })
  );
});

/** Leaves the lesson for its neighbor through the pagination link, as a reader does. */
const leaveLesson = Effect.fn("NakafaE2E.leaveLesson")(function* (page: Page) {
  const link = paginationNavigation(page).locator(SUBJECT_LINK).first();
  const target = yield* Effect.promise(() => link.getAttribute("href"));
  yield* Effect.promise(() => link.click());
  yield* Effect.promise(() =>
    page.waitForURL((url) => url.pathname === target)
  );
});

/** Mounts the lesson's first scene, then leaves the lesson for another page. */
const mountThenLeave = Effect.fn("NakafaE2E.mountThenLeave")(function* (
  page: Page
) {
  yield* mountAxisLabels(page);
  yield* leaveLesson(page);
});

/**
 * A lesson the acceptance runtime serves whose nuclide map runs from 5 to 9
 * neutrons across and protons up, a frame far from zero.
 */
const ISOTOPE_ROUTE = "/en/subjects/chemistry/structure-matter/isotope";
const NUCLIDE_TITLE = "Isotopes Line Up, Ions Stay Put";

/** How far, in pixels, a number of an axis out of view may stand from the edge it sticks to. */
const EDGE_ROOM = 40;

/** One number of an axis as the picture shows it: its value and its box within the picture. */
const TickSchema = Schema.Struct({
  bottom: Schema.Finite,
  left: Schema.Finite,
  right: Schema.Finite,
  top: Schema.Finite,
  value: Schema.Finite,
});

/** The numbers one picture shows on each axis, and the picture's own size. */
const TicksSchema = Schema.Struct({
  height: Schema.Finite,
  width: Schema.Finite,
  x: Schema.Array(TickSchema),
  y: Schema.Array(TickSchema),
});
type Tick = typeof TickSchema.Type;
type Ticks = typeof TicksSchema.Type;

/**
 * Reads the visible numbers of the x and y axes under `root`, each with its
 * box measured from the picture's top left corner. The page serializes this
 * function.
 */
function readTicks(picture: Element, root: string): Ticks {
  const frame = picture.getBoundingClientRect();
  const read = (axis: string) =>
    Array.from(
      picture.querySelectorAll(`${root} [data-axis-tick="${axis}"]`)
    ).flatMap((tick) => {
      if (!tick.checkVisibility({ visibilityProperty: true })) {
        return [];
      }
      const box = tick.getBoundingClientRect();
      return [
        {
          bottom: box.bottom - frame.top,
          left: box.left - frame.left,
          right: box.right - frame.left,
          top: box.top - frame.top,
          value: Number(tick.textContent?.replace(",", ".")),
        },
      ];
    });
  return {
    height: frame.height,
    width: frame.width,
    x: read("x"),
    y: read("y"),
  };
}

/** Reads the numbers of one layer of a picture: its still or its scene. */
const pictureTicks = (picture: Locator, root: string) =>
  picture.evaluate(readTicks, root);

/**
 * Holds a frame far from zero to the unbounded world: both axes lie out of
 * view, so the numbers of x stick to the bottom edge and rise left to right,
 * and the numbers of y stick to the left edge and rise bottom to top, every
 * one a real value of the frame.
 */
function expectStickyTicks({ height, x, y }: Ticks) {
  expect(x.length, "numbers on x").toBeGreaterThanOrEqual(3);
  expect(y.length, "numbers on y").toBeGreaterThanOrEqual(3);
  for (const tick of x) {
    expect(height - tick.bottom, "x number from the bottom edge").toBeLessThan(
      EDGE_ROOM
    );
    expect(tick.value).toBeGreaterThanOrEqual(3);
    expect(tick.value).toBeLessThanOrEqual(11);
  }
  for (const tick of y) {
    expect(tick.left, "y number from the left edge").toBeLessThan(EDGE_ROOM);
    expect(tick.value).toBeGreaterThanOrEqual(3);
    expect(tick.value).toBeLessThanOrEqual(11);
  }
  const across = Arr.sort(
    x,
    Order.mapInput(Order.Number, (tick: Tick) => tick.left)
  );
  const up = Arr.sort(
    y,
    Order.mapInput(Order.Number, (tick: Tick) => -tick.top)
  );
  expect(Arr.map(across, ({ value }) => value)).toEqual(
    Arr.sort(
      Arr.map(x, ({ value }) => value),
      Order.Number
    )
  );
  expect(Arr.map(up, ({ value }) => value)).toEqual(
    Arr.sort(
      Arr.map(y, ({ value }) => value),
      Order.Number
    )
  );
}

/**
 * Opens the nuclide map, a frame far from zero, and holds its still and its
 * scene to the unbounded world (N3): the still's grid fills the whole picture,
 * and in both the numbers of each axis stick to the picture's edge with the
 * frame's real values, where a bounded world stopped at the frame.
 */
const checkFarFrame = Effect.fn("NakafaE2E.checkFarFrame")(function* (
  page: Page
) {
  yield* openRoute(page, ISOTOPE_ROUTE);
  const card = mathSceneCards(page).filter({ hasText: NUCLIDE_TITLE });
  const picture = card.locator(MATH_SCENE);
  yield* Effect.promise(() => card.scrollIntoViewIfNeeded());
  const grid = picture.locator('[data-slot="scene-grid"]');
  const [frame, lines] = yield* Effect.promise(() =>
    Promise.all([picture.boundingBox(), grid.boundingBox()])
  );
  yield* Effect.sync(() => {
    expect(lines, "the still's grid").not.toBeNull();
    expect(Math.abs((lines?.width ?? 0) - (frame?.width ?? 0))).toBeLessThan(1);
    expect(Math.abs((lines?.height ?? 0) - (frame?.height ?? 0))).toBeLessThan(
      1
    );
  });
  const still = yield* Effect.promise(() =>
    pictureTicks(picture, '[data-slot="scene-still"]')
  );
  yield* Effect.sync(() => expectStickyTicks(still));
  yield* revealLineScene(card);
  yield* Effect.promise(() =>
    expect(async () => {
      expectStickyTicks(
        await pictureTicks(picture, '[data-slot="axis-ticks"]')
      );
    }).toPass({ timeout: revealTimeoutMilliseconds })
  );
});

test.describe("lesson scene axes", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("label the x, y, and z axes, then leave the lesson without a page error", async ({
    page,
  }) => {
    await Effect.runPromise(withObservedPageErrors(page, mountThenLeave(page)));
  });

  test("number a frame far from zero at the picture's edges, in the still and the scene", async ({
    page,
  }) => {
    await Effect.runPromise(withObservedPageErrors(page, checkFarFrame(page)));
  });
});
