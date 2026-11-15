import { expect, type Locator, test } from "@playwright/test";
import { Effect } from "effect";
import { openChatPage, runOnPage } from "@/e2e/support/chat";
import { entrySetHref } from "@/e2e/support/entry";
import { activate } from "@/e2e/support/input";
import { questionArticle } from "@/e2e/support/player";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { desktopViewport, viewportSize } from "@/e2e/support/viewport";

/** How a checked question's badge reads. */
const GRADED = /^(?:Correct|Wrong)$/u;

/** A checked question's verdict badge, apart from the words its marked options say to a screen reader. */
const verdictIn = (article: Locator) =>
  article.locator("[data-slot=badge]").filter({ hasText: GRADED });

/** The name of an option the key marks correct. */
const CORRECT = /Correct\s*$/u;

/** The name of question 1's seat once it was checked. */
const FIRST_CHECKED = /^Question 1, (?:correct|wrong)$/u;

/** The name of the practice's pane, its sheet and its landmark. */
const PANE = "Your practice";

test.describe("Practice beside the try-out", () => {
  test.describe.configure({ timeout: 240_000 });
  test.use({ viewport: viewportSize(desktopViewport) });

  test("opens from the start's dialog with no clock, checks a question at once, keeps it through a reload, and starts again", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        yield* openChatPage(page, origin);
        yield* Effect.promise(() =>
          page.goto(entrySetHref, { waitUntil: "commit" })
        );
        // The start's dialog asks how to take the set; Practice opens it with no clock.
        const start = page
          .locator("main")
          .getByRole("button", { exact: true, name: "Start" });
        yield* Effect.promise(() =>
          expect(start).toBeEnabled({
            timeout: readinessTimeoutMilliseconds,
          })
        );
        yield* activate(start, false);
        const dialog = page.getByRole("dialog");
        yield* activate(
          dialog.getByRole("button", { exact: true, name: "Practice" }),
          false
        );
        yield* activate(
          dialog.getByRole("link", { exact: true, name: "Start practice" }),
          false
        );
        const first = questionArticle(page, 1);
        const check = first.getByRole("button", {
          exact: true,
          name: "Check",
        });
        yield* Effect.promise(async () => {
          await expect
            .poll(() => new URL(page.url()).searchParams.get("mode"))
            .toBe("practice");
          await expect(check).toBeDisabled({
            timeout: readinessTimeoutMilliseconds,
          });
          // A practice has no clock and nothing to finish.
          await expect(page.getByRole("timer")).toHaveCount(0);
          await expect(
            page.getByRole("button", { exact: true, name: "Finish" })
          ).toHaveCount(0);
        });

        // An answer enables Check, and the check says how it went at once.
        const option = first.getByRole("radio").first();
        yield* activate(option, false);
        yield* activate(check, false);
        const pane = page.getByRole("complementary", { name: PANE });
        yield* Effect.promise(async () => {
          await expect(verdictIn(first)).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
          // Question 1 is a free sample, so its options are marked against the key, with its explanation.
          await expect(
            first.getByRole("checkbox", { name: CORRECT })
          ).not.toHaveCount(0);
          await expect(
            first.getByRole("heading", { name: "Explanation" })
          ).toBeVisible();
          await expect(
            pane.getByRole("button", { name: FIRST_CHECKED })
          ).toBeVisible();
        });

        // Past the free samples, a free learner's check shows the verdict and the Pro offer.
        const third = questionArticle(page, 3);
        // A question past the samples may take one answer or several, so its first option is either kind.
        yield* activate(
          third.getByRole("radio").or(third.getByRole("checkbox")).first(),
          false
        );
        yield* activate(
          third.getByRole("button", { exact: true, name: "Check" }),
          false
        );
        yield* Effect.promise(async () => {
          await expect(verdictIn(third)).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
          await expect(
            third.getByRole("button", { exact: true, name: "Get Pro" })
          ).toBeVisible();
        });

        // The practice is the learner's own: a reload comes back to both checks.
        yield* Effect.promise(async () => {
          await page.reload({ waitUntil: "commit" });
          await expect(verdictIn(questionArticle(page, 1))).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
          await expect(verdictIn(questionArticle(page, 3))).toBeVisible();
        });

        // Starting again clears every check.
        yield* activate(
          pane.getByRole("button", { exact: true, name: "Start again" }),
          false
        );
        yield* Effect.promise(() =>
          expect(
            questionArticle(page, 1).getByRole("button", {
              exact: true,
              name: "Check",
            })
          ).toBeVisible({ timeout: readinessTimeoutMilliseconds })
        );
      })
    );
  });
});
