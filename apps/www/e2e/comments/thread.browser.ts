import {
  type BrowserContextOptions,
  expect,
  type Page,
  test,
} from "@playwright/test";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { DateTime, Effect } from "effect";
import { LESSON_PATH, openChatPage } from "../support/chat";
import { withBrowserContext } from "../support/context";
import { withObservedPageErrors } from "../support/observe";
import { readinessTimeoutMilliseconds } from "../support/timeout";

const PLACEHOLDER = app.Comments["add-comment-placeholder"];
/** The line above a reply to a reply, in English. */
const REPLYING_TO = /Replying to/;

/** The row of one comment, found by its text. The row's container carries the comment's id. */
function rowOf(page: Page, text: string) {
  return page
    .locator("div[id]")
    .filter({ has: page.getByText(text, { exact: true }) });
}

/** The composer of a new top-level comment, which is the first composer of the list. */
function topComposer(page: Page) {
  return page
    .locator("form")
    .filter({ has: page.getByRole("textbox", { name: PLACEHOLDER }) })
    .first();
}

/** The composer of the reply that is open, which comes after the list's composer. */
function replyComposer(page: Page) {
  return page
    .locator("form")
    .filter({ has: page.getByRole("textbox", { name: PLACEHOLDER }) })
    .last();
}

/** Opens the lesson's comments in one learner's page, with the feed mounted. */
const openComments = Effect.fn("NakafaE2E.openComments")(function* (
  page: Page,
  baseURL: string
) {
  yield* withObservedPageErrors(page, openChatPage(page, baseURL));
  yield* Effect.promise(async () => {
    await page.goto(LESSON_PATH);
    await page.locator("#comments").scrollIntoViewIfNeeded();
  });
});

test("a comment, a reply and a reply to that reply make one thread, a closed reply keeps its words, and a like and a delete show at once", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  const origin = baseURL ?? "";
  const options: BrowserContextOptions = {
    baseURL: origin,
    serviceWorkers: "block",
  };
  // The texts carry the moment of the run, so no comment of an earlier run matches them.
  const stamp = DateTime.toEpochMillis(DateTime.nowUnsafe());
  const top = `Pertanyaan thread ${stamp}.`;
  const reply = `Jawaban thread ${stamp}.`;
  const nested = `Balasan untuk jawaban ${stamp}.`;

  await Effect.runPromise(
    withBrowserContext(browser, options, (authorContext) =>
      withBrowserContext(browser, options, (replierContext) =>
        withBrowserContext(browser, options, (nesterContext) =>
          Effect.gen(function* () {
            const author = yield* Effect.promise(() => authorContext.newPage());
            const replier = yield* Effect.promise(() =>
              replierContext.newPage()
            );
            const nester = yield* Effect.promise(() => nesterContext.newPage());

            yield* openComments(author, origin);
            yield* Effect.promise(async () => {
              await topComposer(author)
                .getByRole("textbox", { name: PLACEHOLDER })
                .fill(top);
              await topComposer(author)
                .getByRole("button", { name: app.Posts.post, exact: true })
                .click();
              await expect(rowOf(author, top)).toBeVisible({
                timeout: readinessTimeoutMilliseconds,
              });
            });

            yield* openComments(replier, origin);
            yield* Effect.promise(async () => {
              await expect(rowOf(replier, top)).toBeVisible({
                timeout: readinessTimeoutMilliseconds,
              });
              await rowOf(replier, top)
                .getByRole("button", { name: app.Common.reply, exact: true })
                .click();
              await expect(
                replyComposer(replier).getByRole("textbox", {
                  name: PLACEHOLDER,
                })
              ).toBeFocused();
              await replyComposer(replier)
                .getByRole("textbox", { name: PLACEHOLDER })
                .fill(reply);
              // Escape closes the reply composer, and its words wait for it.
              await replyComposer(replier)
                .getByRole("textbox", { name: PLACEHOLDER })
                .press("Escape");
              await expect(
                replier.locator("form").filter({
                  has: replier.getByRole("textbox", { name: PLACEHOLDER }),
                })
              ).toHaveCount(1);
              await rowOf(replier, top)
                .getByRole("button", { name: app.Common.reply, exact: true })
                .click();
              await expect(
                replyComposer(replier).getByRole("textbox", {
                  name: PLACEHOLDER,
                })
              ).toHaveValue(reply);
              await replyComposer(replier)
                .getByRole("button", { name: app.Posts.post, exact: true })
                .click();
              await expect(rowOf(replier, reply)).toBeVisible({
                timeout: readinessTimeoutMilliseconds,
              });
            });

            yield* openComments(nester, origin);
            yield* Effect.promise(async () => {
              await expect(rowOf(nester, reply)).toBeVisible({
                timeout: readinessTimeoutMilliseconds,
              });
              await rowOf(nester, reply)
                .getByRole("button", { name: app.Common.reply, exact: true })
                .click();
              await replyComposer(nester)
                .getByRole("textbox", { name: PLACEHOLDER })
                .fill(nested);
              await replyComposer(nester)
                .getByRole("button", { name: app.Posts.post, exact: true })
                .click();
              // The reply to a reply sits in the thread of the top-level comment,
              // and it names the comment it answers.
              await expect(rowOf(nester, nested)).toBeVisible({
                timeout: readinessTimeoutMilliseconds,
              });
              await expect(
                rowOf(nester, nested).getByRole("link", { name: REPLYING_TO })
              ).toBeVisible();
            });

            yield* Effect.promise(async () => {
              await expect(rowOf(author, nested)).toBeVisible({
                timeout: readinessTimeoutMilliseconds,
              });
              // The heart turns red with its count at once: pressed, and enabled
              // while the server answers.
              const like = rowOf(author, top).getByRole("button", {
                name: app.Common.like,
                exact: true,
              });
              await like.click();
              await expect(like).toHaveAttribute("aria-pressed", "true");
              await expect(like).toBeEnabled();
              await expect(like).toContainText("1");
            });

            yield* Effect.promise(async () => {
              await rowOf(author, top)
                .getByRole("button", { name: app.Common.more, exact: true })
                .click();
              await author
                .getByRole("menuitem", { name: app.Common.delete, exact: true })
                .click();
              const dialog = author.getByRole("dialog");
              await expect(dialog).toContainText(app.Comments["delete-title"]);
              await dialog
                .getByRole("button", { name: app.Common.delete, exact: true })
                .click();
              // The thread leaves the author's page and the replier's page.
              await expect(rowOf(author, top)).toHaveCount(0, {
                timeout: readinessTimeoutMilliseconds,
              });
              await expect(rowOf(author, nested)).toHaveCount(0);
              await expect(rowOf(replier, top)).toHaveCount(0, {
                timeout: readinessTimeoutMilliseconds,
              });
              await expect(rowOf(replier, reply)).toHaveCount(0);
            });
          })
        )
      )
    )
  );
});
