import { expect, type Page, test } from "@playwright/test";
import { POST_PAGE_SIZE } from "@repo/backend/client/posts/list";
import { AuthFailure, AuthReadError } from "@repo/backend/confect/auth/spec";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Array as Arr, Effect, Schema } from "effect";
import { saved } from "@/e2e/support/changes";
import { openChatPage, runOnPage } from "@/e2e/support/chat";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

const OLDER = "Kemarin belajar aljabar.";
const POST = "Hari ini belajar trigonometri.";
const REFUSED = "Tulisan yang ditolak server.";
const KEPT = "Post dari server.";
const VIEWPORTS = [
  { name: "a phone", size: { width: 390, height: 844 } },
  { name: "a desktop", size: { width: 1440, height: 900 } },
];
/** The Convex name of the query that reads a profile's posts. */
const POSTS_LIST_QUERY = "posts/queries:list";
/**
 * What the server throws when it cannot read the account behind a query, as the
 * page decodes it. The failure of the list is this typed failure.
 */
const unreadable = Schema.encodeSync(AuthFailure)(
  new AuthReadError({
    code: "AUTH_READ_FAILED",
    message: "Unable to read authentication state.",
  })
);

/** The composer of the owner's own Posts tab. */
const composerOf = (page: Page) =>
  page.getByRole("textbox", { name: app.Posts.placeholder });

/** The rows of the list, newest first. */
const rowsOf = (page: Page) => page.locator('[data-slot="feed-row"]');

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
            // The composer is enabled once the live list holds its first page.
            await expect(composerOf(page)).toBeEnabled({
              timeout: readinessTimeoutMilliseconds,
            });

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
            // The composer is enabled once the live list holds its first page.
            await expect(composerOf(page)).toBeEnabled({
              timeout: readinessTimeoutMilliseconds,
            });

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
              page.getByText(app.Toast["action-error"].title).first()
            ).toBeVisible();
            await expect(postOf(page, REFUSED)).toHaveCount(0);
            await expect(composerOf(page)).toHaveValue(REFUSED);
            await expect(composerOf(page)).not.toHaveAttribute("readonly", "");
          });
        })
      );
    });

    test("a first page that fails shows the server's page under the failure, and the list loads again on Retry", async ({
      baseURL,
      page,
    }) => {
      await runOnPage(page, baseURL, (origin) =>
        Effect.gen(function* () {
          const { changes, learner } = yield* openChatPage(page, origin);
          yield* learner.writePost(KEPT);
          // The live list answers its first page with the failure from now on,
          // so the server's page is all the profile holds until the list recovers.
          changes.failQuery(POSTS_LIST_QUERY, unreadable);
          yield* Effect.promise(() => page.goto(`/en/@${learner.username}`));

          yield* Effect.promise(async () => {
            await expect(postOf(page, KEPT)).toBeVisible({
              timeout: readinessTimeoutMilliseconds,
            });
            await expect(
              page.getByText(app.Common["load-error-retry"])
            ).toBeVisible({
              timeout: readinessTimeoutMilliseconds,
            });
            await expect(page.getByText(app.Posts.empty)).toHaveCount(0);
            await expect(composerOf(page)).toBeDisabled();

            // Retry asks the server for the list anew, and the list holds the post.
            changes.recoverQuery();
            await page.getByRole("button", { name: app.Common.retry }).click();
            await expect(composerOf(page)).toBeEnabled({
              timeout: readinessTimeoutMilliseconds,
            });
            await expect(
              page.getByText(app.Common["load-error-retry"])
            ).toHaveCount(0);
            await expect(postOf(page, KEPT)).toBeVisible();
          });
        })
      );
    });

    test("a later page that fails keeps the posts already shown under the failure, and loads on Retry", async ({
      baseURL,
      page,
    }) => {
      await runOnPage(page, baseURL, (origin) =>
        Effect.gen(function* () {
          const { changes, learner } = yield* openChatPage(page, origin);
          // One post more than a page, so the list has a second page to load.
          yield* Effect.forEach(
            Arr.makeBy(POST_PAGE_SIZE + 1, (index) => `Post ${index + 1}`),
            (text) => learner.writePost(text),
            { discard: true }
          );
          yield* Effect.promise(() => page.goto(`/en/@${learner.username}`));

          yield* Effect.promise(async () => {
            // The composer is enabled once the live list holds its first page.
            await expect(composerOf(page)).toBeEnabled({
              timeout: readinessTimeoutMilliseconds,
            });
            await expect(rowsOf(page)).toHaveCount(POST_PAGE_SIZE);

            // Scrolling to the end asks for the second page, which fails: the
            // rows stay, the failure shows, and nothing asks again by itself.
            changes.failQuery(POSTS_LIST_QUERY, unreadable);
            await rowsOf(page).last().scrollIntoViewIfNeeded();
            await expect(
              page.getByText(app.Common["load-error-retry"])
            ).toBeVisible({
              timeout: readinessTimeoutMilliseconds,
            });
            await expect(rowsOf(page)).toHaveCount(POST_PAGE_SIZE);

            // Retry asks for the list again, and the end of the rows brings the
            // second page.
            changes.recoverQuery();
            await page.getByRole("button", { name: app.Common.retry }).click();
            await expect(
              page.getByText(app.Common["load-error-retry"])
            ).toHaveCount(0, { timeout: readinessTimeoutMilliseconds });
            await rowsOf(page).last().scrollIntoViewIfNeeded();
            await expect(rowsOf(page)).toHaveCount(POST_PAGE_SIZE + 1, {
              timeout: readinessTimeoutMilliseconds,
            });
          });
        })
      );
    });

    test("an error of the list that is no typed failure shows the failure above the server's page, and loads on Retry", async ({
      baseURL,
      page,
    }) => {
      await runOnPage(page, baseURL, (origin) =>
        Effect.gen(function* () {
          const { changes, learner } = yield* openChatPage(page, origin);
          yield* learner.writePost(KEPT);
          // The live list throws an error with no typed failure. The page catches
          // it, so the header and the tabs stay and the failure shows above the
          // server's page.
          changes.failQuery(POSTS_LIST_QUERY, undefined);
          yield* Effect.promise(() => page.goto(`/en/@${learner.username}`));

          yield* Effect.promise(async () => {
            await expect(postOf(page, KEPT)).toBeVisible({
              timeout: readinessTimeoutMilliseconds,
            });
            await expect(
              page.getByText(app.Common["load-error-retry"])
            ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
            await expect(page.getByText(app.Posts.empty)).toHaveCount(0);
            await expect(composerOf(page)).toBeDisabled();

            changes.recoverQuery();
            await page.getByRole("button", { name: app.Common.retry }).click();
            await expect(composerOf(page)).toBeEnabled({
              timeout: readinessTimeoutMilliseconds,
            });
            await expect(
              page.getByText(app.Common["load-error-retry"])
            ).toHaveCount(0);
            await expect(postOf(page, KEPT)).toBeVisible();
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
