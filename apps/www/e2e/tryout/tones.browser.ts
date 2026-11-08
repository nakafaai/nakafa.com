import { expect, type Locator, type Page, test } from "@playwright/test";
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

/** Every question article of the page, the player's or the review's. */
const ARTICLES = 'main article[id^="exercise-question-"]';

/** A reviewed answer's line, in the tone it was drawn with. */
const lineOf = (scope: Locator, tone: string) =>
  scope.locator(`[data-slot="marked-line"][data-tone="${tone}"]`);

/** The article of the set's first true or false table, the player's or the review's. */
const tableArticle = (page: Page) =>
  page
    .locator(ARTICLES)
    .filter({ has: page.getByText("Statement", { exact: true }) })
    .first();

/** How a line's outline is drawn: its width, its style and whether a mark stands inside it. */
const outlineOf = (line: Locator) =>
  line.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      marked: element.querySelector("svg") !== null,
      style: style.borderTopStyle,
      width: style.borderTopWidth,
    };
  });

/**
 * Checks every reviewed line in a scope: a pick that earns the key and one that misses it are outlined solid with a
 * mark, and the key the learner did not pick is outlined dashed with a mark, so it never reads as a pick.
 */
const expectOutlines = Effect.fn("NakafaE2E.expectReviewedOutlines")(function* (
  scope: Locator
) {
  for (const [tone, style] of [
    ["correct", "solid"],
    ["wrong", "solid"],
    ["key", "dashed"],
  ] as const) {
    const lines = yield* Effect.promise(() => lineOf(scope, tone).all());
    for (const line of lines) {
      const outline = yield* Effect.promise(() => outlineOf(line));
      yield* Effect.sync(() => {
        expect(outline).toEqual({ marked: true, style, width: "1px" });
      });
    }
  }
});

test.describe("The marks of a reviewed try-out", () => {
  test.describe.configure({ timeout: 240_000 });

  test("marks the key and each pick on a true or false table as clearly as on an option, and never draws the key as a pick", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        const { learner } = yield* openChatPage(page, origin);
        yield* runFixture(seedXendit(learner.userId, "plan"));
        yield* Effect.promise(() =>
          page.goto(entrySetHref, { waitUntil: "commit" })
        );
        yield* startEntryAttempt(page, "Start", "Start");

        // Question 1 takes its first option, and every statement of the table its first column.
        yield* activate(
          questionArticle(page, 1).getByRole("radio").first(),
          false
        );
        const rows = yield* Effect.promise(() =>
          tableArticle(page).getByRole("radiogroup").all()
        );
        for (const row of rows) {
          const first = row.getByRole("radio").first();
          yield* activate(first, false);
          yield* Effect.promise(() => expect(first).toBeChecked());
        }
        yield* finishEntryAttempt(page);

        const table = tableArticle(page);
        yield* Effect.promise(() =>
          expect(lineOf(table, "correct").or(lineOf(table, "key"))).toHaveCount(
            rows.length,
            { timeout: readinessTimeoutMilliseconds }
          )
        );
        // Each statement shows its key once, and the learner's mark in the first column earns it or misses it.
        const reviewed = yield* Effect.promise(() =>
          table.getByRole("radiogroup").all()
        );
        for (const row of reviewed) {
          yield* Effect.promise(async () => {
            await expect(
              lineOf(row, "correct").or(lineOf(row, "key"))
            ).toHaveCount(1);
            await expect(
              row.locator('[data-slot="marked-line"][data-tone]').first()
            ).toHaveAttribute("data-tone", /^(?:correct|wrong)$/u);
          });
        }
        yield* expectOutlines(table);

        // Question 1's pick earns the key or misses it, and a key it missed is never drawn as a pick.
        const question = questionArticle(page, 1);
        yield* Effect.promise(async () => {
          await expect(
            lineOf(question, "correct").or(lineOf(question, "wrong"))
          ).toHaveCount(1);
          await expect(
            question.getByRole("checkbox", { checked: true })
          ).toHaveCount(1);
          await expect(
            lineOf(question, "key").getByRole("checkbox", { checked: true })
          ).toHaveCount(0);
        });
        yield* expectOutlines(question);
      })
    );
  });
});
