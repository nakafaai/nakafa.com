import "server-only";

import { api } from "@repo/backend/convex/_generated/api";
import type { PublicAppLocale } from "@repo/internationalization/src/routing";
import { fetchQuery } from "convex/nextjs";
import { Effect, Schema } from "effect";
import type { LearningProgramCatalog } from "@/components/programs/contract";
import { applyContentRuntimeCache } from "@/lib/content/cache";
import { filterOnboardingPrograms } from "@/lib/programs/catalog";

/** Expected failure while reading the current user's learning selection. */
export class ActiveLearningSelectionReadError extends Schema.TaggedError<ActiveLearningSelectionReadError>()(
  "ActiveLearningSelectionReadError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Reads the authenticated user's canonical learning selection. */
export const readActiveLearningSelection = Effect.fn(
  "www.learningPrograms.activeSelection"
)(function* (token: string, locale: PublicAppLocale) {
  return yield* Effect.tryPromise({
    try: () =>
      fetchQuery(
        api.learningPrograms.queries.getActiveSelection,
        { locale },
        { token }
      ),
    catch: (cause) =>
      new ActiveLearningSelectionReadError({
        cause,
        message: "Unable to read active learning selection.",
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
async function getLearningProgramCatalog(
  locale: PublicAppLocale
): Promise<LearningProgramCatalog> {
  "use cache";
  applyContentRuntimeCache();

  return await fetchQuery(api.learningPrograms.queries.listSelectablePrograms, {
    locale,
  });
}

/** Reads programs that are ready for learner selection. */
export async function getLearningProgramOnboardingCatalog(
  locale: PublicAppLocale
): Promise<LearningProgramCatalog> {
  const catalog = await getLearningProgramCatalog(locale);

  return filterOnboardingPrograms(catalog);
}
