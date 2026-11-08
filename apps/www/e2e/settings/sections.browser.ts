import { expect, type Page, test } from "@playwright/test";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Array as Arr, Effect } from "effect";
import { runOnPage } from "@/e2e/support/chat";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { holdPageData } from "@/e2e/support/hold";
import { signInLearner } from "@/e2e/support/learner";
import { openObservedRoute } from "@/e2e/support/navigation/prefetch";
import { appRoutes } from "@/e2e/support/route";
import { expectPressKeepsPage } from "@/e2e/support/shell";
import { desktopViewport, viewportSize } from "@/e2e/support/viewport";

test.use({ viewport: viewportSize(desktopViewport) });

/** The address of home, where the way back leads when settings opened first. */
const HOME_URL = /\/en\/home$/u;

/** The sections a learner presses in turn, a library among them, and back from it. */
const SECTIONS = [
  app.Auth.learning,
  app.Auth.billing,
  app.Auth.memory,
  app.Auth.connectors,
  app.Auth.account,
  app.Auth.connectors,
] as const;

/** One link of the settings sidebar, by its exact name. */
const sidebarLink = (page: Page, name: string) =>
  page
    .locator('[data-slot="sidebar"]')
    .getByRole("link", { exact: true, name });

/** The title of the page on screen, which its header names for assistive technology. */
const title = (page: Page, name: string) =>
  page.getByRole("heading", { exact: true, level: 1, name });

/**
 * A press on a settings section changes the address at once, while the next
 * section waits on its data. Every frame until it renders still shows the
 * section the learner left, its header and its column included, and no frame
 * shows a section under a second header. Leaving settings for home keeps the
 * section whole the same way. The data is held, so the wait spans many frames.
 */
test("a press between settings sections keeps the section it leaves whole until the next one renders", async ({
  baseURL,
  page,
}) => {
  await runOnPage(page, baseURL, (origin) =>
    Effect.gen(function* () {
      yield* seedAnalyticsConsent(page, "denied");
      yield* signInLearner(page.context(), origin);
      yield* openObservedRoute(page, appRoutes.settings);
      yield* Effect.promise(() =>
        expect(title(page, app.Auth.account)).toBeAttached()
      );
      yield* holdPageData(page);

      yield* Effect.forEach(
        SECTIONS,
        (section) =>
          expectPressKeepsPage(
            page,
            Effect.promise(() => sidebarLink(page, section).click()),
            Effect.promise(() => expect(title(page, section)).toBeAttached())
          ),
        { discard: true }
      );

      yield* expectPressKeepsPage(
        page,
        Effect.promise(() =>
          sidebarLink(page, app.Auth["back-to-nakafa"]).click()
        ),
        Effect.promise(async () => {
          await expect(page).toHaveURL(HOME_URL);
          await expect(
            title(page, Arr.lastNonEmpty(SECTIONS))
          ).not.toBeAttached();
          await expect(page.locator("main h1").first()).toBeAttached();
        })
      );
    })
  );
});
