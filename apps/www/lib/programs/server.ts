import "server-only";

import { api } from "@repo/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import type {
  ActiveLearningProfile,
  LearningProgramCatalog,
} from "@/components/programs/contract";
import { applyContentRuntimeCache } from "@/lib/content/cache";
import { filterOnboardingPrograms } from "@/lib/programs/catalog";

/** Expected failure while reading the current user's learning profile. */
class ActiveLearningProfileReadError extends Schema.TaggedError<ActiveLearningProfileReadError>()(
  "ActiveLearningProfileReadError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Effect program that reads the authenticated user's learning profile. */
const getActiveLearningProfileEffect = Effect.fn(
  "www.learningPrograms.activeProfile"
)(function* (token: string, locale?: Locale) {
  const args = locale === undefined ? {} : { locale };

  return yield* Effect.tryPromise({
    try: () =>
      fetchQuery(api.learningPrograms.queries.getActiveProfile, args, {
        token,
      }),
    catch: (cause) =>
      new ActiveLearningProfileReadError({
        cause,
        message: "Unable to read active learning profile.",
      }),
  });
});

/**
 * Reads the public selectable program catalog with the app's content cache profile.
 *
 * This Next cache boundary intentionally uses Convex's Promise API directly instead
 * of `Effect.runPromise`. Cache Components may evaluate `"use cache"` during static
 * prerender, and the repo Effect/Next rule forbids starting Effect's fiber runtime
 * there because it reads current time:
 * https://nextjs.org/docs/messages/next-prerender-current-time.
 */
export async function getLearningProgramCatalog(
  locale: Locale
): Promise<LearningProgramCatalog> {
  "use cache";
  applyContentRuntimeCache();

  return await fetchQuery(api.learningPrograms.queries.listSelectablePrograms, {
    locale,
  });
}

/** Reads programs that are ready to start a learner's first plan. */
export async function getLearningProgramOnboardingCatalog(
  locale: Locale
): Promise<LearningProgramCatalog> {
  const catalog = await getLearningProgramCatalog(locale);

  return filterOnboardingPrograms(catalog);
}

/** Reads the active learning profile for the authenticated request token. */
export async function getActiveLearningProfile(
  token: string,
  locale?: Locale
): Promise<ActiveLearningProfile> {
  return await Effect.runPromise(getActiveLearningProfileEffect(token, locale));
}
