import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { activateWelcomeIntent } from "@repo/backend/confect/emails/welcome/impl";
import { setPreferredCurriculumProgram } from "@repo/backend/confect/learningPreferences/impl";
import { readCurriculumProgram } from "@repo/backend/confect/learningPreferences/program";
import type {
  OnboardingCompletion,
  onboardingAnswerValidator,
} from "@repo/backend/confect/onboarding/schema";
import {
  OnboardingProfileError,
  onboardingAlreadyCompleteCode,
  onboardingCurriculumMissingCode,
  onboardingPersistenceFailedCode,
} from "@repo/backend/confect/onboarding/schema";
import {
  getOnboardingDestination,
  getOnboardingRegionDefaults,
} from "@repo/backend/confect/onboarding/spec";
import {
  toOnboardingProfile,
  toOnboardingStatus,
} from "@repo/backend/confect/onboarding/status";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Clock, Effect } from "effect";

type OnboardingAnswer = typeof onboardingAnswerValidator.Type;
const onboardingPersistenceFailedMessage =
  "Unable to read or persist onboarding progress.";
/** Maps unknown database failures into the stable onboarding contract. */
function toOnboardingPersistenceError() {
  return OnboardingProfileError.make({
    code: onboardingPersistenceFailedCode,
    message: onboardingPersistenceFailedMessage,
  });
}

/** Redacts signed-catalog failures behind the onboarding boundary. */
function toOnboardingCurriculumError() {
  return OnboardingProfileError.make({
    code: onboardingCurriculumMissingCode,
    message: "The default curriculum is unavailable.",
  });
}

/** Reads one user's resumable onboarding profile. */
export const readOnboardingProfileByUserId = Effect.fn(
  "onboarding.readProfileByUserId"
)(function* (userId: Id<"users">) {
  const database = yield* DatabaseReader;
  return yield* database
    .table("onboardingProfiles")
    .get("by_userId", userId)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.mapError(toOnboardingPersistenceError),
      Effect.catchDefect(() => Effect.fail(toOnboardingPersistenceError()))
    );
});

/** Preserves the answer's domain type while selecting its stored field. */
function answerFields(answer: OnboardingAnswer) {
  if (answer.kind === "role") {
    return {
      role: answer.value,
    };
  }
  if (answer.kind === "region") {
    return {
      region: answer.value,
    };
  }
  return {
    focus: answer.value,
  };
}

/** Records the first authoritative decision requiring user onboarding. */
export const admitOnboarding = Effect.fn("onboarding.admit")(function* (
  user: Pick<Docs["users"], "_id" | "role">
) {
  const writer = yield* DatabaseWriter;
  const profile = yield* readOnboardingProfileByUserId(user._id);
  const status = toOnboardingStatus(user, profile);
  if (!status.isRequired || profile?.admittedAt !== undefined) {
    return status;
  }
  const now = yield* Clock.currentTimeMillis;
  if (profile) {
    yield* writer
      .table("onboardingProfiles")
      .patch(profile._id, {
        admittedAt: now,
      })
      .pipe(
        Effect.mapError(toOnboardingPersistenceError),
        Effect.catchDefect(() => Effect.fail(toOnboardingPersistenceError()))
      );
  } else {
    yield* writer
      .table("onboardingProfiles")
      .insert({
        admittedAt: now,
        updatedAt: now,
        userId: user._id,
      })
      .pipe(
        Effect.mapError(toOnboardingPersistenceError),
        Effect.catchDefect(() => Effect.fail(toOnboardingPersistenceError()))
      );
  }
  const admittedProfile = yield* readOnboardingProfileByUserId(user._id);
  return toOnboardingStatus(user, admittedProfile);
});

/** Saves one draft answer without applying user settings early. */
export const saveOnboardingAnswer = Effect.fn("onboarding.saveAnswer")(
  function* (userId: Id<"users">, answer: OnboardingAnswer) {
    const writer = yield* DatabaseWriter;
    const current = yield* readOnboardingProfileByUserId(userId);
    if (current?.completedAt !== undefined) {
      return yield* OnboardingProfileError.make({
        code: onboardingAlreadyCompleteCode,
        message: "Onboarding is already complete.",
      });
    }
    const now = yield* Clock.currentTimeMillis;
    const values = {
      ...answerFields(answer),
      admittedAt: current?.admittedAt ?? now,
      startedAt: current?.startedAt ?? now,
      updatedAt: now,
    };
    if (current) {
      yield* writer
        .table("onboardingProfiles")
        .patch(current._id, values)
        .pipe(
          Effect.mapError(toOnboardingPersistenceError),
          Effect.catchDefect(() => Effect.fail(toOnboardingPersistenceError()))
        );
    } else {
      yield* writer
        .table("onboardingProfiles")
        .insert({
          ...values,
          userId,
        })
        .pipe(
          Effect.mapError(toOnboardingPersistenceError),
          Effect.catchDefect(() => Effect.fail(toOnboardingPersistenceError()))
        );
    }
    return toOnboardingProfile({
      ...current,
      ...values,
    });
  }
);

/** Applies every onboarding answer and returns the first app destination. */
export const finishOnboarding = Effect.fn("onboarding.finish")(function* (
  userId: Id<"users">,
  answers: OnboardingCompletion
) {
  const writer = yield* DatabaseWriter;
  const profile = yield* readOnboardingProfileByUserId(userId);
  if (profile?.completedAt !== undefined) {
    return yield* OnboardingProfileError.make({
      code: onboardingAlreadyCompleteCode,
      message: "Onboarding is already complete.",
    });
  }
  const defaults = getOnboardingRegionDefaults(answers.region);
  const curriculum = yield* readCurriculumProgram(
    defaults.locale,
    defaults.curriculumProgramKey
  ).pipe(Effect.mapError(toOnboardingCurriculumError));
  if (!curriculum) {
    return yield* OnboardingProfileError.make({
      code: onboardingCurriculumMissingCode,
      message: "The default curriculum is unavailable.",
    });
  }
  const now = yield* Clock.currentTimeMillis;
  yield* writer
    .table("users")
    .patch(userId, {
      role: answers.role,
    })
    .pipe(
      Effect.mapError(toOnboardingPersistenceError),
      Effect.catchDefect(() => Effect.fail(toOnboardingPersistenceError()))
    );
  yield* setPreferredCurriculumProgram({
    now,
    programKey: curriculum.key,
    userId,
  }).pipe(Effect.mapError(toOnboardingPersistenceError));
  if (profile) {
    yield* writer
      .table("onboardingProfiles")
      .patch(profile._id, {
        ...answers,
        admittedAt: profile.admittedAt ?? now,
        completedAt: now,
        startedAt: profile.startedAt ?? now,
        updatedAt: now,
      })
      .pipe(
        Effect.mapError(toOnboardingPersistenceError),
        Effect.catchDefect(() => Effect.fail(toOnboardingPersistenceError()))
      );
  } else {
    yield* writer
      .table("onboardingProfiles")
      .insert({
        ...answers,
        admittedAt: now,
        completedAt: now,
        startedAt: now,
        updatedAt: now,
        userId,
      })
      .pipe(
        Effect.mapError(toOnboardingPersistenceError),
        Effect.catchDefect(() => Effect.fail(toOnboardingPersistenceError()))
      );
  }
  yield* activateWelcomeIntent(userId, defaults.locale).pipe(
    Effect.mapError(toOnboardingPersistenceError)
  );
  return {
    destination: getOnboardingDestination({
      focus: answers.focus,
      publicSlug: curriculum.publicSlug,
    }),
    locale: defaults.locale,
  };
});
