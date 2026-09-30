import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { readLearningPreferenceByUserId } from "@repo/backend/confect/learningPreferences/impl";
import type { NinaLearnerProfile } from "@repo/backend/confect/nina/memory.spec";
import { readOnboardingProfileByUserId } from "@repo/backend/confect/onboarding/impl";
import { Effect, Option } from "effect";

/** Reads the latest finished try-out with the correct answers per section. */
const readLatestTryout = Effect.fn("nina.memory.profile.tryout")(function* (
  userId: Docs["users"]["_id"]
) {
  const reader = yield* DatabaseReader;
  const score = yield* reader
    .table("tryoutScores")
    .index(
      "by_userId_and_finalizedAt",
      (index) => index.eq("userId", userId),
      "desc"
    )
    .first()
    .pipe(Effect.map(Option.getOrNull), Effect.orDie);
  if (!score) {
    return undefined;
  }
  const attempt = yield* reader
    .table("tryoutAttempts")
    .get(score.tryoutAttemptId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  if (!attempt) {
    return undefined;
  }
  const sections = yield* reader
    .table("tryoutSectionAttempts")
    .index("by_tryoutAttemptId_and_sectionOrder", (index) =>
      index.eq("tryoutAttemptId", attempt._id)
    )
    .take(attempt.sectionSnapshots.length)
    .pipe(Effect.orDie);
  return {
    correct: score.totalCorrect,
    exam: attempt.examKey,
    finishedAt: score.finalizedAt,
    score: score.publishedScore,
    sections: sections.map((section) => ({
      correct: section.correctAnswers,
      key: section.sectionKey,
      total: section.totalQuestions,
    })),
    set: attempt.setKey,
    status: score.scoreStatus,
    total: score.totalQuestions,
  };
});

/** Derives the account facts Nina may use to personalize a turn. */
export const readLearnerProfile = Effect.fn("nina.memory.profile")(function* (
  userId: Docs["users"]["_id"]
) {
  const onboarding = yield* readOnboardingProfileByUserId(userId).pipe(
    Effect.orDie
  );
  const preference = yield* readLearningPreferenceByUserId(userId).pipe(
    Effect.orDie
  );
  const tryout = yield* readLatestTryout(userId);
  return {
    ...(onboarding?.focus ? { focus: onboarding.focus } : {}),
    ...(onboarding?.region ? { region: onboarding.region } : {}),
    ...(tryout ? { tryout } : {}),
    ...(preference?.preferredTryoutCountryKey
      ? { tryoutCountry: preference.preferredTryoutCountryKey }
      : {}),
  } satisfies typeof NinaLearnerProfile.Type;
});
