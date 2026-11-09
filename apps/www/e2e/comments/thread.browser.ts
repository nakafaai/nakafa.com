import { type BrowserContextOptions, expect, test } from "@playwright/test";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { DateTime, Effect } from "effect";
import {
  commentRow,
  commentThread,
  openComments,
  openComposer,
  openReplies,
  postComment,
  replyToComment,
} from "@/e2e/support/comments";
import { withBrowserContext } from "@/e2e/support/context";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The line above a reply to a reply, in English. */
const REPLYING_TO = /Replying to/u;

test("a comment, a reply and a reply to that reply make one thread behind its toggle, a closed reply keeps its words, and a like and a delete show at once", async ({
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
            yield* Effect.promise(() => postComment(author, top));

            yield* openComments(replier, origin);
            yield* Effect.promise(async () => {
              await expect(commentRow(replier, top)).toBeVisible({
                timeout: readinessTimeoutMilliseconds,
              });
              await commentRow(replier, top)
                .getByRole("button", { name: app.Common.reply, exact: true })
                .click();
              await expect(openComposer(replier)).toBeFocused();
              await openComposer(replier).fill(reply);
              // Escape closes the reply composer, and its words wait for it.
              await openComposer(replier).press("Escape");
              await expect(
                replier.getByRole("textbox", {
                  name: app.Comments["add-comment-placeholder"],
                })
              ).toHaveCount(0);
              await commentRow(replier, top)
                .getByRole("button", { name: app.Common.reply, exact: true })
                .click();
              await expect(openComposer(replier)).toHaveText(reply);
              await replier
                .getByRole("button", { name: app.Comments.send, exact: true })
                .last()
                .click();
              await expect(commentRow(replier, reply)).toBeVisible({
                timeout: readinessTimeoutMilliseconds,
              });
            });

            yield* openComments(nester, origin);
            yield* Effect.promise(async () => {
              // A thread opens closed, behind the toggle that counts its replies.
              await expect(commentRow(nester, top)).toBeVisible({
                timeout: readinessTimeoutMilliseconds,
              });
              await expect(commentRow(nester, reply)).toHaveCount(0);
              await openReplies(nester, top);
              await replyToComment(nester, reply, nested);
              // The reply to a reply sits in the thread of the top-level comment,
              // and it names the learner it answers.
              await expect(
                commentThread(nester, top).getByText(nested, { exact: true })
              ).toBeVisible();
              await expect(
                commentRow(nester, nested).getByRole("link", {
                  name: REPLYING_TO,
                })
              ).toBeVisible();
            });

            yield* Effect.promise(async () => {
              await openReplies(author, top);
              await expect(commentRow(author, nested)).toBeVisible({
                timeout: readinessTimeoutMilliseconds,
              });
              // The heart turns red with its count at once: pressed, and enabled
              // while the server answers.
              const like = commentRow(author, top)
                .getByRole("button", { name: app.Common.like, exact: true })
                .first();
              await like.click();
              await expect(like).toHaveAttribute("aria-pressed", "true");
              await expect(like).toBeEnabled();
              await expect(like).toContainText("1");
            });

            yield* Effect.promise(async () => {
              await commentRow(author, top)
                .getByRole("button", {
                  name: app.Common["more-actions"],
                  exact: true,
                })
                .first()
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
              await expect(commentRow(author, top)).toHaveCount(0, {
                timeout: readinessTimeoutMilliseconds,
              });
              await expect(commentRow(author, nested)).toHaveCount(0);
              await expect(commentRow(replier, top)).toHaveCount(0, {
                timeout: readinessTimeoutMilliseconds,
              });
              await expect(commentRow(replier, reply)).toHaveCount(0);
            });
          })
        )
      )
    )
  );
});
