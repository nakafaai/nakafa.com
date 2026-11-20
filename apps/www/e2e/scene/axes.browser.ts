import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { Array as Arr, Effect, Option } from "effect";
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

/** The colors of the x and y axes, as the browser computes them. */
const AXIS_RGB = { x: "rgb(220, 38, 38)", y: "rgb(22, 163, 74)" };

/**
 * The axis values one picture names, each with its axis color and where it
 * stands, and the height of the picture: the still's names carry
 * `data-axis-value`, the scene's are labels whose whole text is one value.
 */
const readAxisValues = (root: Element) => {
  const box = root.getBoundingClientRect();
  return {
    height: box.height,
    values: Array.from(root.querySelectorAll("*"))
      .filter(
        (element) =>
          element.children.length === 0 &&
          ["5", "9"].includes(element.textContent ?? "")
      )
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          color: getComputedStyle(element).color,
          text: element.textContent ?? "",
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
      }),
  };
};

/** The values of one axis, read as text and its spread across the picture's height. */
function axisFacts(
  { height, values }: ReturnType<typeof readAxisValues>,
  color: string
) {
  const ends = Arr.filter(values, (value) => value.color === color);
  const low = Arr.findFirst(ends, ({ text }) => text === "5");
  const high = Arr.findFirst(ends, ({ text }) => text === "9");
  return {
    texts: Arr.map(ends, ({ text }) => text),
    // How far the 5 stands below the 9, as a share of the picture's height.
    spread: Option.getOrElse(
      Option.zipWith(low, high, (five, nine) => (five.y - nine.y) / height),
      () => 0
    ),
  };
}

/**
 * Opens the nuclide map, reads the real values its still names at the ends of
 * both axes, then loads the scene and reads them again: the frame fills the
 * picture from 5 to 9 instead of shrinking to keep zero in sight.
 */
const checkFarFrame = Effect.fn("NakafaE2E.checkFarFrame")(function* (
  page: Page
) {
  yield* openRoute(page, ISOTOPE_ROUTE);
  const card = mathSceneCards(page).filter({ hasText: NUCLIDE_TITLE });
  const picture = card.locator(MATH_SCENE);
  yield* Effect.promise(() => card.scrollIntoViewIfNeeded());
  yield* Effect.promise(() =>
    expect(
      picture
        .locator("[data-axis-value]")
        .evaluateAll((labels) =>
          labels.map((label) => [
            label.getAttribute("data-axis-value"),
            label.textContent,
          ])
        )
    ).resolves.toEqual([
      ["x:min", "5"],
      ["x:max", "9"],
      ["y:min", "5"],
      ["y:max", "9"],
    ])
  );
  const still = yield* Effect.promise(() => picture.evaluate(readAxisValues));
  yield* Effect.sync(() =>
    expect(axisFacts(still, AXIS_RGB.y).spread).toBeGreaterThan(0.5)
  );
  yield* revealLineScene(card);
  yield* Effect.promise(() =>
    expect
      .poll(
        async () => {
          const scene = await picture.evaluate(readAxisValues);
          const x = axisFacts(scene, AXIS_RGB.x);
          const y = axisFacts(scene, AXIS_RGB.y);
          return {
            x: x.texts,
            y: y.texts,
            fills: y.spread > 0.5,
          };
        },
        { timeout: revealTimeoutMilliseconds }
      )
      .toEqual({ fills: true, x: ["5", "9"], y: ["5", "9"] })
  );
});

test.describe("lesson scene axes", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("label the x, y, and z axes, then leave the lesson without a page error", async ({
    page,
  }) => {
    await Effect.runPromise(withObservedPageErrors(page, mountThenLeave(page)));
  });

  test("stand at the edge of a frame far from zero, naming its real values in the still and the scene", async ({
    page,
  }) => {
    await Effect.runPromise(withObservedPageErrors(page, checkFarFrame(page)));
  });
});
