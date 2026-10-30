import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { CHAT_PATH } from "@/e2e/support/chat";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { appRoutes } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The width of a panel folded into its rail, in pixels: `w-12`. */
const RAIL = 48;

/** The pages with a panel on their right side, and the name of its toggle. */
const PANELS = [
  { label: "On this page", page: "lesson", path: pinnedRoutes.material.en },
  { label: "On this page", page: "Quran surah", path: appRoutes.quranSurah },
  { label: "Chat history", page: "new chat", path: CHAT_PATH },
] as const;

/**
 * From 1280 px a panel stands beside the page with its own toggle in its own
 * section at its foot, and no header of the page holds a toggle of a sidebar.
 * The toggle folds the panel into a rail, where the toggle stays, and opens it
 * again.
 */
const verifyPanelToggle = Effect.fn("NakafaE2E.verifyPanelToggle")(function* (
  page: Page,
  label: string
) {
  yield* Effect.promise(() =>
    expect(
      page.locator('header [data-sidebar="trigger"]').filter({ visible: true })
    ).toHaveCount(0)
  );
  const panel = page.locator('[data-side="right"][data-slot="sidebar"]');
  const foot = panel.locator('[data-slot="sidebar-footer"]').last();
  const toggle = foot.getByRole("button", { exact: true, name: label });
  yield* Effect.promise(() =>
    expect(toggle).toBeVisible({ timeout: readinessTimeoutMilliseconds })
  );
  yield* Effect.promise(() =>
    expect(foot).toHaveCSS("border-top-style", "solid")
  );
  yield* Effect.promise(() => waitUntilTakenOver(toggle));
  yield* Effect.promise(() => toggle.click());
  yield* Effect.promise(() =>
    expect(panel).toHaveAttribute("data-collapsible", "icon")
  );
  const rail = panel.locator('[data-slot="sidebar-container"]');
  yield* Effect.promise(() =>
    expect
      .poll(async () => Math.round((await rail.boundingBox())?.width ?? 0))
      .toBe(RAIL)
  );
  yield* Effect.promise(() => expect(toggle).toBeInViewport());
  yield* Effect.promise(() => toggle.click());
  yield* Effect.promise(() =>
    expect(toggle).toHaveAttribute("aria-expanded", "true")
  );
});

test.describe("panels at 1440px", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  for (const { label, page: name, path } of PANELS) {
    test(`the ${name} toggles its panel only from the panel's foot`, async ({
      baseURL,
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(
          page,
          Effect.gen(function* () {
            yield* seedAnalyticsConsent(page, "denied");
            if (path === CHAT_PATH) {
              const origin = yield* Effect.fromNullishOr(baseURL);
              yield* signInLearner(page.context(), origin);
            }
            yield* Effect.promise(() => page.goto(path));
            yield* verifyPanelToggle(page, label);
          })
        )
      );
    });
  }
});
