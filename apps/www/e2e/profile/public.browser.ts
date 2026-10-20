import { expect, type Page, test } from "@playwright/test";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { openChatPage, runOnPage } from "../support/chat";
import { readinessTimeoutMilliseconds } from "../support/timeout";

const POST = "Hari ini belajar trigonometri.";
const VIEWPORTS = [
  { name: "a phone", size: { width: 390, height: 844 } },
  { name: "a desktop", size: { width: 1440, height: 900 } },
];

/** The rows of a profile's Posts tab, newest first. */
const rowsOf = (page: Page) => page.locator('[data-slot="feed-row"]');

for (const viewport of VIEWPORTS) {
  test.describe(`a public profile on ${viewport.name}`, () => {
    test.use({ viewport: viewport.size });

    test("a signed-out visitor reads another learner's posts, sees the Comments tab and no Chat tab, and gets no composer or Edit profile but a Share profile button", async ({
      baseURL,
      page,
    }) => {
      await runOnPage(page, baseURL, (origin) =>
        Effect.gen(function* () {
          const { learner } = yield* openChatPage(page, origin);
          yield* learner.writePost(POST);
          // Clearing the cookies of the context signs the page out, so the
          // profile opens for a visitor with no session.
          yield* Effect.promise(() => page.context().clearCookies());
          yield* Effect.promise(() => page.goto(`/en/@${learner.username}`));

          yield* Effect.promise(async () => {
            await expect(rowsOf(page).filter({ hasText: POST })).toBeVisible({
              timeout: readinessTimeoutMilliseconds,
            });
            await expect(
              page.getByRole("tab", { name: app.Common.comments })
            ).toBeVisible();
            await expect(
              page.getByRole("tab", { name: app.Common.chat })
            ).toHaveCount(0);
            await expect(
              page.getByRole("textbox", { name: app.Posts.placeholder })
            ).toHaveCount(0);
            await expect(
              page.getByRole("link", { name: app.Auth["edit-profile"] })
            ).toHaveCount(0);
            await expect(
              page.getByRole("button", { name: app.Auth["share-profile"] })
            ).toBeVisible();
          });
        })
      );
    });
  });
}
