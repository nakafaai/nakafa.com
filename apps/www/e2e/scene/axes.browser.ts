import { expect, type Locator, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { openRoute } from "@/e2e/support/route";
import { revealLineScene } from "@/e2e/support/scene";
import {
  LINE_SCENE,
  lineSceneCards,
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
  yield* openRoute(page, pinnedRoutes.material.en, "denied");
  const card = lineSceneCards(page).first();
  const scene = card.locator(LINE_SCENE);
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

test.describe("lesson scene axes", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("label the x, y, and z axes, then leave the lesson without a page error", async ({
    page,
  }) => {
    await Effect.runPromise(withObservedPageErrors(page, mountThenLeave(page)));
  });
});
