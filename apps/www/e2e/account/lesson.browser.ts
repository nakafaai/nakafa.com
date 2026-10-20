import { type BrowserContextOptions, expect, test } from "@playwright/test";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { DateTime, Effect } from "effect";
import { LESSON_PATH } from "@/e2e/support/chat";
import { withBrowserContext } from "@/e2e/support/context";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";

const PLACEHOLDER = app.Comments["add-comment-placeholder"];

/**
 * A signed-in learner's lesson load shows the account footer, and a comment posted
 * in the lesson's feed shows in it. The feed mounts on the page's Convex island once
 * the session has settled, so the account and the comment read one client.
 */
test("a signed-in lesson load shows the account and posts a comment", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  const origin = baseURL ?? "";
  const options: BrowserContextOptions = {
    baseURL: origin,
    serviceWorkers: "block",
  };
  // The text carries the moment of the run, so no comment of an earlier run matches it.
  const stamp = DateTime.toEpochMillis(DateTime.nowUnsafe());
  const text = `Komentar lesson ${stamp}.`;

  await Effect.runPromise(
    withBrowserContext(browser, options, (context) =>
      Effect.gen(function* () {
        yield* signInLearner(context, origin);
        const page = yield* Effect.promise(() => context.newPage());
        yield* withObservedPageErrors(
          page,
          Effect.gen(function* () {
            yield* Effect.promise(() =>
              page.goto(LESSON_PATH, { waitUntil: "load" })
            );
            yield* Effect.promise(() =>
              expect(
                page.locator('[data-account="member"]').first()
              ).toBeVisible()
            );
            yield* Effect.promise(() =>
              page.locator("#comments").scrollIntoViewIfNeeded()
            );
            yield* Effect.promise(() =>
              page.getByPlaceholder(PLACEHOLDER).first().fill(text)
            );
            yield* Effect.promise(() =>
              page
                .getByRole("button", { name: app.Posts.post, exact: true })
                .first()
                .click()
            );
            yield* Effect.promise(() =>
              expect(page.getByText(text, { exact: true })).toBeVisible()
            );
          })
        );
      })
    )
  );
});
