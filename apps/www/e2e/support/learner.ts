import type { BrowserContext } from "@playwright/test";
import { seedLearner } from "@repo/backend/scripts/content/acceptance/learner";
import { seedOperator } from "@repo/backend/scripts/content/acceptance/operator";
import { Effect } from "effect";
import { runFixture } from "@/e2e/support/acceptance";
import { addSessionCookies } from "@/e2e/support/context";

/**
 * Signs a new synthetic learner into one browser context. The running local
 * acceptance runtime creates the learner and its session in its own database,
 * so each test starts from a learner with no attempts and no real account is
 * ever involved.
 */
export const signInLearner = Effect.fn("NakafaE2E.signInLearner")(function* (
  context: BrowserContext,
  baseURL: string
) {
  // Convex stops a query or mutation of the local backend after five seconds
  // of its own code, and a machine busy with other work stretches the calls of
  // a sign-in past it now and then. The seed removes what a failed attempt
  // created, so any failure is tried again with a new learner.
  const cookie = yield* runFixture(seedLearner()).pipe(
    Effect.retry({ times: 2 })
  );
  yield* addSessionCookies(context, cookie, baseURL);
});

/**
 * Signs a new synthetic operator into one browser context: a learner whose account the
 * running local acceptance runtime granted operator access to.
 */
export const signInOperator = Effect.fn("NakafaE2E.signInOperator")(function* (
  context: BrowserContext,
  baseURL: string
) {
  const cookie = yield* runFixture(seedOperator()).pipe(
    Effect.retry({ times: 2 })
  );
  yield* addSessionCookies(context, cookie, baseURL);
});
