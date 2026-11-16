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
import {
  openComments,
  postComment,
  replyToComment,
} from "@/e2e/support/comments";
import { withBrowserContext } from "@/e2e/support/context";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

const INBOX = "/en/notifications";
const REPLIED = app.Notifications["comment-replied"];
const REPLY_MAIL = `${app.Notifications["kind-commentReply"]}, ${app.Notifications.channel.email}`;
/** The address of a lesson that opens one of its comments. */
const OPENS_COMMENT = /comment=/u;

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
          yield* Effect.promise(() => postComment(author, question));
          yield* openComments(replier, origin);
          yield* Effect.promise(() =>
            replyToComment(replier, question, answer)
          );

          yield* Effect.promise(async () => {
            await author.goto(INBOX);
            await author
              .getByRole("tab", {
                name: app.Notifications.topic.comments,
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
            // A second page of the author reads the choice from the server. Opening it leaves the first
            // page, which may still be sending the choice, in place, where a reload of it would end it.
            const again = await authorContext.newPage();
            await again.goto(INBOX);
            await expect(await openReplyMail(again)).not.toBeChecked();
          });
        })
      )
    )
  );
});
