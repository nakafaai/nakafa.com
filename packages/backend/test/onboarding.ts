import {
  LearningProgramKeySchema,
  LearningProgramSchema,
} from "@nakafa/aksara-contracts/program/spec";
import type { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  activateProgramSnapshot,
  makeProgramSnapshotData,
  makeTechnicalProgram,
} from "@repo/backend/test/program/snapshot";
import { Effect } from "effect";

/** Activates every curriculum key used by onboarding defaults. */
export const activateOnboardingPrograms = Effect.fn(
  "test.onboarding.activatePrograms"
)(function* (test: ReturnType<typeof createConvexTestWithBetterAuth>) {
  const programs = [
    makeOnboardingProgram(1, "merdeka", "merdeka"),
    makeOnboardingProgram(2, "cambridge-international", "cambridge"),
    makeOnboardingProgram(3, "singapore-moe", "singapore"),
    makeOnboardingProgram(4, "united-states", "united-states"),
  ];
  const data = yield* makeProgramSnapshotData(programs);
  yield* Effect.promise(() => activateProgramSnapshot(test, data));
});

/** Builds one signed school curriculum with a stable onboarding key and slug. */
function makeOnboardingProgram(index: number, key: string, publicSlug: string) {
  const base = makeTechnicalProgram(index);
  const [firstTranslation, ...remainingTranslations] = base.translations;
  return LearningProgramSchema.make({
    ...base,
    key: LearningProgramKeySchema.make(key),
    translations: [
      { ...firstTranslation, publicSlug },
      ...remainingTranslations.map((translation) => ({
        ...translation,
        publicSlug,
      })),
    ],
  });
}
