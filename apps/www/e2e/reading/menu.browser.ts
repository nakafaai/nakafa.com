import { expect, test } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** How long the main thread stays busy between a click's press and its release, past UI SDK's 200 ms hold. */
const BUSY_CLICK_MILLISECONDS = 300;

test("a click on a busy main thread keeps the menu it opened open", async ({
  page,
}) => {
  const href = pinnedRoutes.material.en;
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        yield* Effect.promise(() =>
          page.setViewportSize({ width: 1440, height: 900 })
        );
        yield* Effect.promise(() => page.goto(href));
        yield* waitForCommittedAppRouter(
          page,
          href,
          href,
          readinessTimeoutMilliseconds
        );
        const more = page
          .getByRole("group", { name: "Content actions", exact: true })
          .getByRole("button", { name: "More actions", exact: true });
        const box = yield* Effect.promise(() => more.boundingBox());
        if (box === null) {
          return yield* Effect.die("The reading menu's button has no box.");
        }
        yield* Effect.promise(() =>
          page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        );
        yield* Effect.promise(() => page.mouse.down());
        // The release waits behind a long task, as on a slow phone, though
        // the pointer never moved: the press is a click, not a hold. A layer
        // then stands over the button, as an open sheet or a list aligned
        // with its button does, so the release lands on the button only if
        // the button holds the pointer.
        yield* Effect.promise(() =>
          page.evaluate((busy) => {
            const cover = document.createElement("div");
            cover.dataset.e2eCover = "";
            cover.style.cssText = "position:fixed;inset:0;z-index:2147483647";
            document.body.append(cover);
            const end = performance.now() + busy;
            let spins = 0;
            while (performance.now() < end) {
              spins += 1;
            }
            return spins;
          }, BUSY_CLICK_MILLISECONDS)
        );
        yield* Effect.promise(() => page.mouse.up());
        yield* Effect.promise(() =>
          page.locator("[data-e2e-cover]").evaluate((cover) => cover.remove())
        );
        const menu = page.getByRole("menu");
        yield* Effect.promise(() =>
          expect(more).toHaveAttribute("aria-expanded", "true")
        );
        yield* Effect.promise(() =>
          expect(
            menu.getByText(en.Common["menu-actions"], { exact: true })
          ).toBeVisible()
        );
        yield* Effect.promise(() => page.keyboard.press("Escape"));
        yield* Effect.promise(() =>
          expect(more).toHaveAttribute("aria-expanded", "false")
        );
      })
    )
  );
});
