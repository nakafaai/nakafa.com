import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { saved, trackChanges } from "@/e2e/support/changes";
import { activate } from "@/e2e/support/input";
import { withObservedPageErrors } from "@/e2e/support/observe";
import {
  chooseView,
  expectView,
  finishSection,
  openSurface,
  questionArticle,
  runFirstSection,
  sidebarOf,
} from "@/e2e/support/player";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { tryoutViewports } from "@/e2e/support/viewport";
import { waitUntilTakenOver } from "@/e2e/support/window";

/**
 * Opens the navigator where the viewport shows it: the sidebar is always open
 * from the large breakpoint, and `G` opens the sheet below it.
 */
const openNavigator = Effect.fn("NakafaE2E.openPlayerNavigator")(function* (
  page: Page,
  hasTouch: boolean
) {
  if (!hasTouch) {
    return sidebarOf(page);
  }
  yield* Effect.promise(() => page.keyboard.press("g"));
  const sheet = openSurface(page);
  yield* Effect.promise(() =>
    expect(sheet).toBeVisible({ timeout: readinessTimeoutMilliseconds })
  );
  return sheet;
});

/** Closes the navigator sheet again; the sidebar stays open. */
const closeNavigator = Effect.fn("NakafaE2E.closePlayerNavigator")(function* (
  page: Page,
  hasTouch: boolean
) {
  if (!hasTouch) {
    return;
  }
  yield* Effect.promise(() => page.keyboard.press("g"));
  yield* Effect.promise(() =>
    expect(openSurface(page)).toBeHidden({
      timeout: readinessTimeoutMilliseconds,
    })
  );
});

/** Expects the navigator to name one number the way a screen reader hears it. */
const expectCell = Effect.fn("NakafaE2E.expectPlayerCell")(function* (
  page: Page,
  hasTouch: boolean,
  name: string
) {
  const navigator = yield* openNavigator(page, hasTouch);
  yield* Effect.promise(() =>
    expect(navigator.getByRole("button", { exact: true, name })).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    })
  );
  yield* closeNavigator(page, hasTouch);
});

/**
 * Flags a question from the footer and from the key, shows the flag in the
 * navigator at once and after a reload, turns next into review on the last
 * question, lists the flagged and the unanswered questions in the review, goes
 * back to a flagged question from it, scrolls the list, and finishes.
 */
const verifyFlags = Effect.fn("NakafaE2E.verifyPlayerFlags")(function* (
  page: Page,
  hasTouch: boolean,
  baseURL: string
) {
  const changes = yield* trackChanges(page, []);
  yield* runFirstSection(page, hasTouch, baseURL);
  yield* expectView(page, "List");
  yield* chooseView(page, hasTouch, "One question");
  yield* expectView(page, "One question");
  const flag = page.getByRole("button", { exact: true, name: "Flag" });

  // The footer's flag marks the current question at once, and so does its number.
  yield* activate(flag, hasTouch);
  yield* Effect.promise(() =>
    expect(flag).toHaveAttribute("aria-pressed", "true")
  );
  yield* expectCell(
    page,
    hasTouch,
    "Question 1, unanswered, flagged for review"
  );

  // Next shows the next question alone, which carries no flag, and an answer marks it.
  yield* activate(
    page.getByRole("button", { exact: true, name: "Next question" }),
    hasTouch
  );
  yield* Effect.promise(() => expect(questionArticle(page, 2)).toBeVisible());
  yield* Effect.promise(() => expect(questionArticle(page, 1)).toBeHidden());
  yield* Effect.promise(() =>
    expect(flag).toHaveAttribute("aria-pressed", "false")
  );
  yield* activate(
    questionArticle(page, 2).getByRole("radio").first(),
    hasTouch
  );
  yield* expectCell(page, hasTouch, "Question 2, answered");

  // F flags the current question as the button does.
  const sentBefore = changes.sent;
  yield* Effect.promise(() => page.keyboard.press("f"));
  yield* Effect.promise(() =>
    expect(flag).toHaveAttribute("aria-pressed", "true")
  );

  // The flags are the server's, so a reload shows them once the page is React's again.
  // The press shows the flag before the server has it, and a reload drops a change still
  // on its way, so the reload waits until the server answered every change.
  yield* Effect.promise(() => saved(changes, sentBefore));
  yield* Effect.promise(() => page.reload({ waitUntil: "commit" }));
  yield* Effect.promise(() =>
    waitUntilTakenOver(page.getByRole("button", { exact: true, name: "Flag" }))
  );
  yield* expectCell(
    page,
    hasTouch,
    "Question 1, unanswered, flagged for review"
  );
  yield* expectCell(page, hasTouch, "Question 2, answered, flagged for review");

  // The last number goes to the last question, where next becomes review.
  const navigator = yield* openNavigator(page, hasTouch);
  // The numbers are the items of the navigator's ordered list; the legend is not one.
  const numbers = navigator.locator("ol > li");
  const total = yield* Effect.promise(() => numbers.count());
  yield* activate(numbers.last().getByRole("button"), hasTouch);
  yield* Effect.promise(() =>
    expect(questionArticle(page, total)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    })
  );
  yield* Effect.promise(() =>
    expect(
      page.getByRole("button", { exact: true, name: "Next question" })
    ).toHaveCount(0)
  );

  // The review lists the flagged questions, then the unanswered ones without a flag.
  yield* activate(
    page.getByRole("button", { exact: true, name: "Review" }),
    hasTouch
  );
  const review = openSurface(page);
  yield* Effect.promise(() =>
    expect(
      review.getByRole("heading", { exact: true, name: "Flagged" })
    ).toBeVisible({ timeout: readinessTimeoutMilliseconds })
  );
  yield* Effect.promise(() =>
    expect(
      review.getByRole("heading", { exact: true, name: "Unanswered" })
    ).toBeVisible()
  );
  yield* Effect.promise(() =>
    expect(
      review.getByRole("button", {
        exact: true,
        name: "Question 2, answered, flagged for review",
      })
    ).toBeVisible()
  );
  yield* Effect.promise(() =>
    expect(
      review.getByRole("button", {
        exact: true,
        name: `Question ${total}, unanswered`,
      })
    ).toBeVisible()
  );
  yield* Effect.promise(() =>
    expect(
      review.getByRole("button", {
        exact: true,
        name: "Question 1, unanswered",
      })
    ).toHaveCount(0)
  );

  // A flagged number leads back to its question, where the flag comes off.
  yield* activate(
    review.getByRole("button", {
      exact: true,
      name: "Question 1, unanswered, flagged for review",
    }),
    hasTouch
  );
  yield* Effect.promise(() =>
    expect(review).toBeHidden({ timeout: readinessTimeoutMilliseconds })
  );
  yield* Effect.promise(() => expect(questionArticle(page, 1)).toBeVisible());
  yield* activate(flag, hasTouch);
  yield* Effect.promise(() =>
    expect(flag).toHaveAttribute("aria-pressed", "false")
  );
  yield* expectCell(page, hasTouch, "Question 1, unanswered");

  // The list scrolls through every question, and Finish ends the section from its review.
  yield* chooseView(page, hasTouch, "List");
  yield* expectView(page, "List");
  yield* finishSection(page, hasTouch);
});

for (const viewport of tryoutViewports) {
  test.describe(`Try-out flags on ${viewport.name}`, () => {
    test.use({
      hasTouch: viewport.hasTouch,
      viewport: { height: viewport.height, width: viewport.width },
    });

    test("flags questions, reviews them, and finishes from the review", async ({
      baseURL,
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(
          page,
          Effect.fromNullishOr(baseURL).pipe(
            Effect.flatMap((origin) =>
              verifyFlags(page, viewport.hasTouch, origin)
            )
          )
        )
      );
    });
  });
}
