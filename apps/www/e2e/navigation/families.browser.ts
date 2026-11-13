import { expect, type Locator, type Page, test } from "@playwright/test";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { runOnPage } from "@/e2e/support/chat";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { holdPageData } from "@/e2e/support/hold";
import { signInLearner } from "@/e2e/support/learner";
import { openObservedRoute } from "@/e2e/support/navigation/prefetch";
import { finishOnboarding } from "@/e2e/support/onboarding";
import { expectPressKeepsPage } from "@/e2e/support/shell";
import { desktopViewport, viewportSize } from "@/e2e/support/viewport";

test.use({ viewport: viewportSize(desktopViewport) });

/** The trigger of the signed-in learner's account menu. */
const ACCOUNT_TRIGGER =
  '[data-account="member"]:visible button[aria-haspopup="menu"]';

/** The first title of the page on screen. */
const firstTitle = (page: Page) => page.locator("main h1").first();

/** One link of the sidebar, by its exact name. */
const sidebarLink = (page: Page, name: string) =>
  page
    .locator('[data-slot="sidebar"]')
    .getByRole("link", { exact: true, name });

/** One item of the account menu, which opens first. */
const accountItem = async (page: Page, name: string) => {
  await page.locator(ACCOUNT_TRIGGER).click();
  return page.getByRole("menuitem", { exact: true, name });
};

/** One press of the walk: the control it presses, and the address it opens. */
interface Step {
  readonly control: (page: Page) => Promise<Locator>;
  readonly path: RegExp;
}

/**
 * The walk through every family of the learner's pages: a subject list, the
 * try-outs, the Quran, an article category, Nina's chat, the notifications,
 * the profile, the settings, and back to the page before them.
 */
const WALK: readonly Step[] = [
  {
    control: async (page) => sidebarLink(page, app.Common.subject),
    // The learner's own curriculum once onboarding chose one, else the list of them.
    path: /\/en\/curriculum(?:\/[^/]+)?$/u,
  },
  {
    control: async (page) => sidebarLink(page, app.Common["try-out"]),
    path: /\/en\/try-out$/u,
  },
  {
    control: async (page) => sidebarLink(page, app.Holy.quran),
    path: /\/en\/quran$/u,
  },
  {
    control: async (page) =>
      page
        .locator('[data-slot="sidebar"] a[href^="/en/articles/"]:visible')
        .first(),
    path: /\/en\/articles\/[^/]+$/u,
  },
  {
    control: async (page) => sidebarLink(page, app.Ai["ask-nina"]),
    path: /\/en\/chat$/u,
  },
  {
    control: (page) => accountItem(page, app.Common.notifications),
    path: /\/en\/notifications$/u,
  },
  {
    control: (page) => accountItem(page, app.Auth.profile),
    path: /\/en\/(?:user\/|@)[^/]+$/u,
  },
  {
    control: (page) => accountItem(page, app.Common.settings),
    path: /\/en\/user\/settings$/u,
  },
  {
    control: async (page) => sidebarLink(page, app.Common["back-to-nakafa"]),
    path: /\/en\/(?:user\/|@)[^/]+$/u,
  },
];

/**
 * A press changes the address at once, while the next page waits on its data.
 * On every family of the learner's pages, each frame until that page renders
 * still shows the page the learner left, its title, header and frame
 * included, and no frame shows a third page. The data is held, so the wait
 * spans many frames.
 */
test("every family of the learner's pages keeps the page a press leaves whole until the next one renders", async ({
  baseURL,
  page,
}) => {
  await runOnPage(page, baseURL, (origin) =>
    Effect.gen(function* () {
      yield* seedAnalyticsConsent(page, "denied");
      yield* signInLearner(page.context(), origin);
      yield* Effect.promise(() => finishOnboarding(page));
      yield* openObservedRoute(page, "/en/home");
      yield* Effect.promise(() => expect(firstTitle(page)).toBeAttached());
      yield* holdPageData(page);

      yield* Effect.forEach(
        WALK,
        (step) =>
          Effect.gen(function* () {
            const left = yield* Effect.promise(() =>
              firstTitle(page).textContent()
            ).pipe(Effect.map((text) => text ?? ""));
            yield* expectPressKeepsPage(
              page,
              Effect.promise(async () => {
                const control = await step.control(page);
                await control.click();
              }),
              Effect.promise(async () => {
                await expect(page).toHaveURL(step.path);
                await expect(firstTitle(page)).not.toHaveText(left);
              })
            );
          }),
        { discard: true }
      );
    })
  );
});
