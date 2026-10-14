import { expect, test } from "@playwright/test";
import { encodePrettyJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect } from "effect";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { exchange, said } from "@/e2e/support/transcript/message";
import { showChat, startTranscript } from "@/e2e/support/transcript/open";

/**
 * The loaded messages of a chat of `count` messages, a question and Nina's
 * reply for each pair, as the Agent feed serves them to the page.
 */
function conversationOf(count: number) {
  return Arr.flatMap(
    Arr.makeBy(count / 2, (index) =>
      exchange({
        order: index + 1,
        parts: [
          said(`Reply number ${index + 1}, with a few words of its own.`),
        ],
        question: `Question number ${index + 1}`,
      })
    ),
    (pair) => pair
  );
}

/**
 * Measures what a long chat mounts: the elements of its main region once every
 * loaded message is shown. The counts are attached to the run, for the
 * transcript decision of the Nina blueprint. The fixture seeds the messages
 * through the page's own socket, so the page loads them as the feed does.
 */
for (const count of [50, 200, 500]) {
  test(`mounts the elements of ${count} loaded messages`, async ({
    baseURL,
    page,
  }, testInfo) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.gen(function* () {
          const origin = yield* Effect.fromNullishOr(baseURL);
          const shown = yield* startTranscript(page, origin);
          yield* showChat(page, shown, "en", conversationOf(count));
          const elements = yield* Effect.promise(() =>
            page.evaluate(() => document.querySelectorAll("main *").length)
          );
          yield* Effect.promise(() =>
            testInfo.attach(`elements-${count}.json`, {
              body: Buffer.from(
                encodePrettyJsonText({ elements, messages: count })
              ),
              contentType: "application/json",
            })
          );
          expect(elements).toBeGreaterThan(0);
        })
      )
    );
  });
}
