import { expect, test } from "@playwright/test";
import { seedXendit } from "@repo/backend/scripts/content/acceptance/xendit";
import { Effect } from "effect";
import { runFixture } from "@/e2e/support/acceptance";
import { openChatPage, runOnPage } from "@/e2e/support/chat";
import {
  entrySetHref,
  finishEntryAttempt,
  startEntryAttempt,
} from "@/e2e/support/entry";
import { activate } from "@/e2e/support/input";
import { questionArticle } from "@/e2e/support/player";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** A text alternative that says something. */
const NAMED = /\S/u;

/**
 * The try-out questions whose explanation draws a figure of the Visual Catalog: the set that holds
 * the question, the question's number, and the element its visual draws as its figure. The
 * acceptance release serves the first set of each track, and each set has one section, so
 * finishing it opens the review. A figure in a prompt draws through the same component, which
 * the School figure spec proves on a student's sitting. Content that places a new kind of visual
 * in a try-out adds its question here, such as a lab of the SPM visual-first revision.
 */
const CASES = [
  {
    name: "a plane scene of TKA compulsory mathematics",
    number: 20,
    scene: '[data-scene="math"]',
    set: entrySetHref,
  },
] as const;

test.describe("try-out figures", () => {
  test.describe.configure({ timeout: 240_000 });

  for (const figureCase of CASES) {
    test(`draw ${figureCase.name} in an explanation through the lesson renderer, under its text alternative`, async ({
      baseURL,
      page,
    }) => {
      await runOnPage(page, baseURL, (origin) =>
        Effect.gen(function* () {
          const { learner } = yield* openChatPage(page, origin);
          yield* runFixture(seedXendit(learner.userId, "plan"));
          yield* Effect.promise(() =>
            page.goto(figureCase.set, { waitUntil: "commit" })
          );
          yield* startEntryAttempt(page, "Start", "Start");
          yield* finishEntryAttempt(page);

          // The explanation's visual draws as a figure that its title names.
          const reviewed = questionArticle(page, figureCase.number);
          yield* activate(
            reviewed.getByRole("button", { exact: true, name: "Explanation" }),
            false
          );
          yield* Effect.promise(async () => {
            const figure = reviewed
              .getByRole("figure")
              .and(reviewed.locator(figureCase.scene));
            await expect(figure).toBeVisible({
              timeout: readinessTimeoutMilliseconds,
            });
            await expect(figure).toHaveAccessibleName(NAMED);
            await reviewed.screenshot({
              path: test.info().outputPath("explanation-figure.png"),
            });
          });
        })
      );
    });
  }
});
