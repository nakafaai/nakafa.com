import { type BrowserContextOptions, expect, test } from "@playwright/test";
import { DateTime, Effect } from "effect";
import { LESSON_PATH } from "@/e2e/support/chat";
import { postComment } from "@/e2e/support/comments";
import { withBrowserContext } from "@/e2e/support/context";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";

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
            yield* Effect.promise(() => postComment(page, text));
          })
        );
      })
    )
  );
});
