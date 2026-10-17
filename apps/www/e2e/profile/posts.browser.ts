import { expect, type Page, test } from "@playwright/test";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { live, saved } from "@/e2e/support/changes";
import { openChatPage, runOnPage } from "@/e2e/support/chat";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

const OLDER = "Kemarin belajar aljabar.";
const POST = "Hari ini belajar trigonometri.";
const REFUSED = "Tulisan yang ditolak server.";
const VIEWPORTS = [
  { name: "a phone", size: { width: 390, height: 844 } },
  { name: "a desktop", size: { width: 1440, height: 900 } },
];

/** The composer of the owner's own Posts tab. */
const composerOf = (page: Page) =>
  page.getByRole("textbox", { name: app.Posts.placeholder });

/** The rows of the list, newest first. */
const rowsOf = (page: Page) => page.locator('[data-slot="post-row"]');

/** The post with this text in the list. */
const postOf = (page: Page, text: string) =>
  rowsOf(page).filter({ hasText: text });

for (const viewport of VIEWPORTS) {
  test.describe(`posts on ${viewport.name}`, () => {
    test.use({ viewport: viewport.size });

    test("a learner writes a post, sees it at the top at once, likes it, takes the like back, and deletes it after confirming", async ({
      baseURL,
      page,
    }) => {
      await runOnPage(page, baseURL, (origin) =>
        Effect.gen(function* () {
          const { changes, learner } = yield* openChatPage(page, origin);
          yield* Effect.promise(() => page.goto(`/en/@${learner.username}`));

          yield* Effect.promise(async () => {
            await expect(composerOf(page)).toBeEnabled({
              timeout: readinessTimeoutMilliseconds,
            });
            await live(changes);

            // An older post is on the list first, so the new post is at the
            // top only when the list puts it there.
            const older = changes.sent;
            await composerOf(page).fill(OLDER);
            await page.getByRole("button", { name: app.Posts.post }).click();
            await saved(changes, older);
            await expect(postOf(page, OLDER)).toBeVisible();

            // The post shows at once, before the server has saved it.
            const before = changes.sent;
            await composerOf(page).fill(POST);
            await page.getByRole("button", { name: app.Posts.post }).click();
            await expect(postOf(page, POST)).toBeVisible();
            await expect(rowsOf(page).nth(0)).toContainText(POST);
            await expect(rowsOf(page).nth(1)).toContainText(OLDER);
            await expect(composerOf(page)).toHaveValue("");
            await saved(changes, before);

            // The like shows at once, and the count appears beside it.
            const like = postOf(page, POST).getByRole("button", {
              name: app.Common.like,
            });
            const liking = changes.sent;
            await like.click();
            await expect(like).toHaveAttribute("aria-pressed", "true");
            await expect(like).toContainText("1");
            await saved(changes, liking);

            const unliking = changes.sent;
            await like.click();
            await expect(like).toHaveAttribute("aria-pressed", "false");
            await saved(changes, unliking);

            // Delete asks first, and the post leaves the list once confirmed.
            await postOf(page, POST)
              .getByRole("button", { name: app.Common.more })
              .click();
            await page
              .getByRole("menuitem", { name: app.Common.delete })
              .click();
            const dialog = page.getByRole("dialog");
            await expect(dialog).toContainText(app.Posts["delete-title"]);
            const deleting = changes.sent;
            await dialog
              .getByRole("button", { name: app.Common.delete })
              .click();
            await expect(postOf(page, POST)).toHaveCount(0);
            await saved(changes, deleting);
          });
        })
      );
    });

    test("a post the server refuses leaves the list and gives its text back with a message", async ({
      baseURL,
      page,
    }) => {
      await runOnPage(page, baseURL, (origin) =>
        Effect.gen(function* () {
          const { changes, learner } = yield* openChatPage(page, origin);
          yield* Effect.promise(() => page.goto(`/en/@${learner.username}`));

          yield* Effect.promise(async () => {
            await expect(composerOf(page)).toBeEnabled({
              timeout: readinessTimeoutMilliseconds,
            });
            await live(changes);

            // The next change never reaches the server, and the server answers
            // wait until the test releases them. While they wait the post shows
            // and the text is locked, so nothing the learner types is lost.
            changes.failNext();
            changes.hold();
            await composerOf(page).fill(REFUSED);
            await page.getByRole("button", { name: app.Posts.post }).click();
            await expect(postOf(page, REFUSED)).toBeVisible();
            await expect(composerOf(page)).toHaveAttribute("readonly", "");
            changes.release();
            await expect(
              page.getByText(app.Common["action-error"]).first()
            ).toBeVisible();
            await expect(postOf(page, REFUSED)).toHaveCount(0);
            await expect(composerOf(page)).toHaveValue(REFUSED);
            await expect(composerOf(page)).not.toHaveAttribute("readonly", "");
          });
        })
      );
    });

    test("the Comments tab opens at its own address, and the Posts tab keeps the username address", async ({
      baseURL,
      page,
    }) => {
      await runOnPage(page, baseURL, (origin) =>
        Effect.gen(function* () {
          const { learner } = yield* openChatPage(page, origin);
          yield* Effect.promise(() => page.goto(`/en/@${learner.username}`));

          yield* Effect.promise(async () => {
            await page.getByRole("tab", { name: app.Common.comments }).click();
            await expect(page).toHaveURL(
              new RegExp(`/en/@${learner.username}/comments$`),
              { timeout: readinessTimeoutMilliseconds }
            );
            // The page is the Comments tab, not a not-found page.
            await expect(
              page.getByRole("tab", { name: app.Common.comments })
            ).toHaveAttribute("aria-selected", "true");
            await page.getByRole("tab", { name: app.Common.posts }).click();
            await expect(page).toHaveURL(
              new RegExp(`/en/@${learner.username}$`),
              { timeout: readinessTimeoutMilliseconds }
            );
          });
        })
      );
    });
  });
}
