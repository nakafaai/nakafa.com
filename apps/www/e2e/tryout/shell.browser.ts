import type { Page } from "@playwright/test";
import { test } from "@playwright/test";
import { Effect } from "effect";
import { visibleLink } from "@/e2e/support/input";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { waitForQuiet } from "@/e2e/support/quiet";
import {
  expectStillShell,
  observeShell,
  readPageTime,
  readShellObservation,
} from "@/e2e/support/shell";
import {
  arrive,
  onPath,
  openCountry,
  openSetPane,
  openTrack,
  setHref,
  trackHref,
} from "@/e2e/support/tryout";
import { tryoutViewports } from "@/e2e/support/viewport";

/**
 * Walks from the try-out catalog to a set's pane, then back, while recording every frame. The app shell must stay
 * one mounted, visible, unlocked element, every frame must show a page heading, and nothing may shift.
 */
const verifyTryoutShell = Effect.fn("NakafaE2E.verifyTryoutShell")(function* (
  page: Page,
  hasTouch: boolean
) {
  yield* observeShell(page);
  yield* openCountry(page);
  const since = yield* readPageTime(page);
  yield* openTrack(page, hasTouch);
  yield* Effect.promise(() => waitForQuiet(page));
  const catalog = yield* readShellObservation(page, since);
  yield* Effect.sync(() => expectStillShell(catalog, [false]));

  // A set the visitor has not started opens beside the table. The pane takes the page's right side at the
  // press, which moves the page's column by design, so the walk back is observed from the open pane.
  yield* openSetPane(page, hasTouch);
  yield* Effect.promise(() => waitForQuiet(page));
  const fromPane = yield* readPageTime(page);

  yield* Effect.promise(() => page.goBack({ waitUntil: "commit" }));
  yield* arrive(page, onPath(trackHref), visibleLink(page, setHref, "main"));
  // Late streamed content would still move the page, so keep observing until it goes quiet.
  yield* Effect.promise(() => waitForQuiet(page));

  const observation = yield* readShellObservation(page, fromPane);
  yield* Effect.sync(() => expectStillShell(observation, [false]));
});

for (const viewport of tryoutViewports) {
  test.describe(`Try-out shell on ${viewport.name}`, () => {
    test.use({
      hasTouch: viewport.hasTouch,
      viewport: { height: viewport.height, width: viewport.width },
    });

    test("stays mounted and visible from the catalog to a set and back", async ({
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(page, verifyTryoutShell(page, viewport.hasTouch))
      );
    });
  });
}
