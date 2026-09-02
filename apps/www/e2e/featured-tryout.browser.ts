import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import {
  withBrowserContext,
  withObservedPageErrors,
} from "@/e2e/support/browser-context";
import { seedDeniedAnalyticsConsent } from "@/e2e/support/consent";

const FEATURED_TRYOUT_HEADING =
  "After learning, see what you really understood";
const EXPECTED_CORRECT_RESPONSE = "19";
const EXPECTED_INCORRECT_RESPONSE = "10";

/** Proves the signed landing question still matches Nina's adjacent result. */
test("landing tryout keeps its signed Nina-aligned question", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      {
        baseURL: baseURL ?? "",
        reducedMotion: "reduce",
        serviceWorkers: "block",
        viewport: { height: 900, width: 1440 },
      },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          yield* withObservedPageErrors(
            page,
            Effect.gen(function* () {
              yield* seedDeniedAnalyticsConsent(page);
              const response = yield* Effect.promise(() =>
                page.goto("/en", { waitUntil: "domcontentloaded" })
              );
              yield* Effect.sync(() => expect(response?.ok()).toBe(true));

              const feature = page
                .getByRole("heading", {
                  exact: true,
                  name: FEATURED_TRYOUT_HEADING,
                })
                .locator("..");
              const answers = feature.getByRole("radiogroup", {
                name: "Answer",
              });
              const choices = answers.getByRole("radio");
              const status = feature.getByRole("status");

              yield* Effect.promise(() => feature.scrollIntoViewIfNeeded());
              yield* Effect.promise(() => expect(choices).toHaveCount(5));

              const initialIncorrect = answers.getByRole("radio", {
                exact: true,
                name: EXPECTED_INCORRECT_RESPONSE,
              });
              const initialCorrect = answers.getByRole("radio", {
                exact: true,
                name: EXPECTED_CORRECT_RESPONSE,
              });
              yield* Effect.promise(() => expect(initialIncorrect).toHaveCount(1));
              yield* Effect.promise(() => expect(initialCorrect).toHaveCount(1));

              yield* Effect.promise(() => initialIncorrect.click());
              const incorrectChoice = answers.getByRole("radio", {
                exact: true,
                name: `${EXPECTED_INCORRECT_RESPONSE} Incorrect`,
              });
              const correctChoice = answers.getByRole("radio", {
                exact: true,
                name: `${EXPECTED_CORRECT_RESPONSE} Correct`,
              });
              yield* Effect.promise(() => expect(incorrectChoice).toBeChecked());
              yield* Effect.promise(() => expect(correctChoice).toHaveCount(1));
              yield* Effect.promise(() => expect(status).toHaveText("Incorrect"));

              yield* Effect.promise(() => correctChoice.click());
              yield* Effect.promise(() => expect(correctChoice).toBeChecked());
              yield* Effect.promise(() => expect(incorrectChoice).not.toBeChecked());
              yield* Effect.promise(() => expect(status).toHaveText("Correct"));
            })
          );
        })
    )
  );
});
