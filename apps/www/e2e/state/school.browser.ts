import { test } from "@playwright/test";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import en from "@repo/internationalization/dictionaries/standalone/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { expectState } from "@/e2e/support/state";
import { touchViewport } from "@/e2e/support/viewport";

/**
 * A school that no learner belongs to. The proxy lets a signed-in learner in,
 * and the school page finds no school by this slug, so it calls `notFound()`
 * and the not-found page of School answers.
 */
const UNKNOWN_SCHOOL = "/en/school/missing";

test.describe("the state of a school that cannot be found", () => {
  test.use({
    hasTouch: touchViewport.hasTouch,
    viewport: { height: touchViewport.height, width: touchViewport.width },
  });

  test("shows School's own words and the two ways on to a signed-in learner", async ({
    baseURL,
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.gen(function* () {
          const origin = yield* Effect.fromNullishOr(baseURL);
          yield* signInLearner(page.context(), origin);
          yield* seedAnalyticsConsent(page, "denied");
          yield* Effect.promise(() =>
            page.goto(UNKNOWN_SCHOOL, { waitUntil: "domcontentloaded" })
          );
          yield* expectState(page, {
            description: app.School.Missing.description,
            links: [
              { href: "/en/school", label: app.School.Missing["back-button"] },
              { href: "/en", label: en.State["home-button"] },
            ],
            title: app.School.Missing.title,
          });
        })
      )
    );
  });
});
