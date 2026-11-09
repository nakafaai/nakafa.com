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
import { LESSON_PATH, openChatPage } from "@/e2e/support/chat";
import { withBrowserContext } from "@/e2e/support/context";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

const PLACEHOLDER = app.Comments["add-comment-placeholder"];
const INBOX = "/en/notifications";
const REPLIED = app.Notifications["comment-replied"];
const REPLY_MAIL = `${app.Notifications["kind-commentReply"]}, ${app.Notifications["channel-email"]}`;
/** The address of a lesson that opens one of its comments. */
const OPENS_COMMENT = /comment=/u;

/** The row of one comment, found by its text. The row's container carries the comment's id. */
function rowOf(page: Page, text: string) {
  return page
    .locator("div[id]")
    .filter({ has: page.getByText(text, { exact: true }) });
}

/** Writes one comment into a composer of the list, the last one that is open. */
async function post(page: Page, text: string) {
  const composer = page
    .locator("form")
    .filter({ has: page.getByRole("textbox", { name: PLACEHOLDER }) })
    .last();
  await composer.getByRole("textbox", { name: PLACEHOLDER }).fill(text);
  await composer
    .getByRole("button", { name: app.Posts.post, exact: true })
    .click();
  await expect(rowOf(page, text)).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
}

/** Opens the Nakafa inbox's preferences, and answers the switch of a reply's mail. */
async function openReplyMail(page: Page) {
  const preferences = page
    .locator("header")
    .getByRole("button", { name: app.Notifications.preferences });
  await waitUntilTakenOver(preferences);
  await preferences.click();
  const mail = page
    .getByRole("dialog")
    .getByRole("switch", { name: REPLY_MAIL });
  await expect(mail).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  return mail;
}

/** Opens the lesson's comments in one learner's page, with the feed mounted. */
const openComments = Effect.fn("NakafaE2E.openNoticeComments")(function* (
  page: Page,
  baseURL: string
) {
  yield* withObservedPageErrors(page, openChatPage(page, baseURL));
  yield* Effect.promise(async () => {
    await page.goto(LESSON_PATH);
    await page.locator("#comments").scrollIntoViewIfNeeded();
  });
});

/**
 * A reply reaches the learner it answers: a row in the Nakafa inbox under the
 * Comments topic, which opens the reply on its lesson, above the list, and reads
 * itself. The learner who replied gets no row for their own reply, and the author
 * switches the reply's mail off from the same inbox.
 */
test("a reply to a comment reaches its author's inbox and opens the reply", async ({
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
  const question = `Pertanyaan notifikasi ${stamp}.`;
  const answer = `Jawaban notifikasi ${stamp}.`;

  await Effect.runPromise(
    withBrowserContext(browser, options, (authorContext) =>
      withBrowserContext(browser, options, (replierContext) =>
        Effect.gen(function* () {
          const author = yield* Effect.promise(() => authorContext.newPage());
          const replier = yield* Effect.promise(() => replierContext.newPage());
          yield* openComments(author, origin);
          yield* Effect.promise(() => post(author, question));
          yield* openComments(replier, origin);
          yield* Effect.promise(async () => {
            await rowOf(replier, question)
              .getByRole("button", { name: app.Common.reply, exact: true })
              .click();
            await post(replier, answer);
          });

          yield* Effect.promise(async () => {
            await author.goto(INBOX);
            await author
              .getByRole("tab", {
                name: app.Notifications["topic-comments"],
              })
              .click();
            const row = author.getByRole("link", { name: REPLIED }).first();
            await expect(row).toBeVisible({
              timeout: readinessTimeoutMilliseconds,
            });
            await row.click();
            await expect(author).toHaveURL(OPENS_COMMENT);
            await expect(author.getByText(answer).first()).toBeVisible({
              timeout: readinessTimeoutMilliseconds,
            });
          });

          yield* Effect.promise(async () => {
            await replier.goto(INBOX);
            await expect(
              replier.getByRole("link", { name: REPLIED })
            ).toHaveCount(0);
          });

          yield* Effect.promise(async () => {
            await author.goto(INBOX);
            const mail = await openReplyMail(author);
            await expect(mail).toBeChecked();
            await mail.click();
            await expect(mail).not.toBeChecked();
            await author.reload();
            await expect(await openReplyMail(author)).not.toBeChecked();
          });
        })
      )
    )
  );
});
