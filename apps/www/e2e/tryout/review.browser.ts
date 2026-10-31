import { expect, type Page, test } from "@playwright/test";
import { Effect, Schema } from "effect";
import { runAcceptanceCommand } from "@/e2e/support/acceptance";
import type { Changes } from "@/e2e/support/changes";
import { openChatPage, runOnPage, START } from "@/e2e/support/chat";
import {
  entrySetHref,
  finishEntryAttempt,
  startEntryAttempt,
} from "@/e2e/support/entry";
import { activate } from "@/e2e/support/input";
import { questionArticle } from "@/e2e/support/player";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The questions of the set, each reviewed on the set page once the attempt ends. */
const QUESTIONS = 25;

/** Every question article of the page, the player's or the review's. */
const ARTICLES = 'main article[id^="exercise-question-"]';

/** The name of an option the key marks correct; an incorrect one ends with "Incorrect". */
const CORRECT = /Correct\s*$/u;

/** The global that holds the fewest question articles the page showed while it watched. */
const FEWEST = "__nakafaFewestReviewArticles";

/** What Nina's start sends for an ask about one reviewed question. */
const AskArguments = Schema.Tuple([
  Schema.Struct({
    input: Schema.Struct({
      page: Schema.Struct({
        focus: Schema.Struct({
          attemptId: Schema.String,
          kind: Schema.Literal("tryout-question"),
          placementId: Schema.String,
        }),
      }),
      prompt: Schema.Struct({ text: Schema.String }),
    }),
  }),
]);

/** The attempt the address of the page names. */
const attemptOfUrl = (page: Page) =>
  new URL(page.url()).searchParams.get("attemptId");

/**
 * Starts an attempt from the set page with its action and the dialog's
 * `primary` button, picks the first option of question 1 when `answer` asks
 * for it, and finishes the attempt. The set has one section, so finishing it
 * ends the attempt and the review shows under the score.
 */
const takeAttempt = Effect.fn("NakafaE2E.takeTryoutAttempt")(function* (
  page: Page,
  action: string,
  primary: string,
  answer: boolean
) {
  yield* startEntryAttempt(page, action, primary);
  if (answer) {
    const option = questionArticle(page, 1).getByRole("radio").first();
    yield* activate(option, false);
    yield* Effect.promise(() => expect(option).toBeChecked());
  }
  yield* finishEntryAttempt(page);
});

/**
 * Checks the full review of a Pro learner: every question with its explanation
 * and an Ask Nina button, the options of question 1 marked against the key,
 * and the learner's own pick checked when `answered`.
 */
const expectFullReview = Effect.fn("NakafaE2E.expectFullTryoutReview")(
  function* (page: Page, answered: boolean) {
    const articles = page.locator(ARTICLES);
    yield* Effect.promise(async () => {
      await expect(
        articles.getByRole("button", { exact: true, name: "Ask Nina" })
      ).toHaveCount(QUESTIONS, { timeout: readinessTimeoutMilliseconds });
      await expect(articles).toHaveCount(QUESTIONS);
      await expect(
        articles.getByRole("button", { exact: true, name: "Explanation" })
      ).toHaveCount(QUESTIONS);
      await expect(
        page.locator('[data-slot="tryout-review-locked"]')
      ).toHaveCount(0);
    });
    const question = questionArticle(page, 1);
    yield* Effect.promise(async () => {
      // Each option's name ends with its mark, and the key marks one or more correct.
      await expect(
        question.getByRole("checkbox", { name: CORRECT })
      ).not.toHaveCount(0);
      await expect(
        question.getByRole("checkbox", { checked: true })
      ).toHaveCount(answered ? 1 : 0);
    });
    // An explanation opens under its question.
    yield* activate(
      questionArticle(page, 1).getByRole("button", {
        exact: true,
        name: "Explanation",
      }),
      false
    );
    yield* Effect.promise(() =>
      expect(
        questionArticle(page, 1).getByRole("heading", { name: "Explanation" })
      ).toBeVisible()
    );
  }
);

/**
 * Asks Nina about question 3 of the review: Nina opens, and the ask sends a
 * prompt that names the question and a focus on the reviewed attempt and the
 * question's placement. The ask is refused before the server runs it, so no
 * model answers in the test, and Nina says it could not confirm the request.
 */
const askAboutQuestion = Effect.fn("NakafaE2E.askNinaAboutTryoutQuestion")(
  function* (page: Page, changes: Changes) {
    changes.failNext(START);
    yield* activate(
      questionArticle(page, 3).getByRole("button", {
        exact: true,
        name: "Ask Nina",
      }),
      false
    );
    yield* Effect.promise(() =>
      expect.poll(() => changes.argumentsOf(START).length).toBe(1)
    );
    const [ask] = yield* Schema.decodeUnknownEffect(AskArguments)(
      changes.argumentsOf(START)[0]
    );
    yield* Effect.promise(() =>
      expect(page.getByPlaceholder("Ask Nina anything...")).toBeVisible()
    );
    yield* Effect.sync(() => {
      expect(ask.input.prompt.text).toBe("Help me understand question 3.");
    });
    return ask.input.page.focus;
  }
);

/**
 * Chooses one attempt in the score card's history and waits for its own page.
 * The page keeps the review it showed until the chosen attempt arrives, so the
 * fewest question articles it showed meanwhile is the whole review.
 */
const chooseAttempt = Effect.fn("NakafaE2E.chooseTryoutAttempt")(function* (
  page: Page,
  shown: number,
  chosen: number
) {
  const before = attemptOfUrl(page);
  yield* Effect.promise(() =>
    page.evaluate(
      ({ key, selector }) => {
        const count = () => document.querySelectorAll(selector).length;
        Reflect.set(window, key, count());
        new MutationObserver(() => {
          Reflect.set(window, key, Math.min(Reflect.get(window, key), count()));
        }).observe(document.body, { childList: true, subtree: true });
      },
      { key: FEWEST, selector: ARTICLES }
    )
  );
  yield* activate(
    page
      .locator("main")
      .getByRole("button", { exact: true, name: `Attempt ${shown}` }),
    false
  );
  yield* activate(
    page.getByRole("option", {
      name: new RegExp(`^Attempt ${chosen}\\b`, "u"),
    }),
    false
  );
  yield* Effect.promise(async () => {
    await expect.poll(() => attemptOfUrl(page)).not.toBe(before);
    await expect(
      page
        .locator("main")
        .getByRole("button", { exact: true, name: `Attempt ${chosen}` })
    ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
    await expect(page.locator(ARTICLES)).toHaveCount(QUESTIONS);
    expect(await page.evaluate((key) => Reflect.get(window, key), FEWEST)).toBe(
      QUESTIONS
    );
  });
  return attemptOfUrl(page);
});

test.describe("The review of a finished try-out", () => {
  // Each attempt runs and finishes the whole set before its review shows.
  test.describe.configure({ timeout: 240_000 });

  test("shows a Pro learner every question with its key, explanation and Ask Nina, and each attempt of the history its own review", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        const { changes, learner } = yield* openChatPage(page, origin);
        yield* runAcceptanceCommand("xendit", learner.userId, "plan");
        yield* Effect.promise(() =>
          page.goto(entrySetHref, { waitUntil: "commit" })
        );

        // The first attempt answers question 1, and its review shows that pick.
        yield* takeAttempt(page, "Start", "Start", true);
        yield* expectFullReview(page, true);
        const focus = yield* askAboutQuestion(page, changes);

        // Restart takes the set again; the second attempt answers nothing.
        yield* Effect.promise(() => page.keyboard.press("Escape"));
        yield* takeAttempt(page, "Restart", "Restart", false);
        yield* expectFullReview(page, false);

        // Each attempt of the history opens its own page, with its own review.
        const first = yield* chooseAttempt(page, 2, 1);
        yield* expectFullReview(page, true);
        const second = yield* chooseAttempt(page, 1, 2);
        yield* expectFullReview(page, false);
        yield* Effect.sync(() => {
          expect(first).toBe(focus.attemptId);
          expect(second).not.toBeNull();
          expect(second).not.toBe(first);
        });
      })
    );
  });

  test("shows a free learner the preview under the Pro offer", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        yield* openChatPage(page, origin);
        yield* Effect.promise(() =>
          page.goto(entrySetHref, { waitUntil: "commit" })
        );
        yield* takeAttempt(page, "Start", "Start free", true);
        yield* Effect.promise(async () => {
          await expect(
            page.locator('[data-slot="tryout-review-locked"]')
          ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
          await expect(page.locator("#tryout-review-offer")).toBeVisible();
          await expect(
            page
              .locator(ARTICLES)
              .getByRole("button", { exact: true, name: "Ask Nina" })
          ).toHaveCount(0);
        });
      })
    );
  });
});
