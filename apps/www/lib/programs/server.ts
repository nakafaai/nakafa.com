import "server-only";

import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { api } from "@repo/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { Effect, Schema } from "effect";
import type {
  ActiveLearningSelection,
  LearningProgramCatalog,
} from "@/components/programs/contract";
import { applyContentRuntimeCache } from "@/lib/content/cache";
import { filterOnboardingPrograms } from "@/lib/programs/catalog";

/** Expected failure while reading the current user's learning selection. */
class ActiveLearningSelectionReadError extends Schema.TaggedError<ActiveLearningSelectionReadError>()(
  "ActiveLearningSelectionReadError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Reads the authenticated user's canonical learning selection. */
const readActiveLearningSelection = Effect.fn(
  "www.learningPrograms.activeSelection"
)(function* (token: string, locale: ActiveAppLocaleCode) {
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
  locale: ActiveAppLocaleCode
): Promise<LearningProgramCatalog> {
  "use cache";
  applyContentRuntimeCache();

  return await fetchQuery(api.learningPrograms.queries.listSelectablePrograms, {
    locale,
  });
}

/** Reads programs that are ready for learner selection. */
export async function getLearningProgramOnboardingCatalog(
  locale: ActiveAppLocaleCode
): Promise<LearningProgramCatalog> {
  const catalog = await getLearningProgramCatalog(locale);

  return filterOnboardingPrograms(catalog);
}

/** Reads the active learning selection for the authenticated request token. */
export async function getActiveLearningSelection(
  token: string,
  locale: ActiveAppLocaleCode
): Promise<ActiveLearningSelection> {
  return await Effect.runPromise(readActiveLearningSelection(token, locale));
}
