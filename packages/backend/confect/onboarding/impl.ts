import { DatabaseReader, DatabaseWriter } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
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
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { Clock, Effect, flow, type Schema } from "effect";

type OnboardingAnswer = Schema.Schema.Type<typeof onboardingAnswerValidator>;
type OnboardingCtx = MutationCtx | QueryCtx;
const onboardingPersistenceFailedMessage =
  "Unable to read or persist onboarding progress.";
/** Maps unknown database failures into the stable onboarding contract. */
function toOnboardingPersistenceError() {
  return new OnboardingProfileError({
    code: onboardingPersistenceFailedCode,
    message: onboardingPersistenceFailedMessage,
  });
}

/** Redacts signed-catalog failures behind the onboarding boundary. */
function toOnboardingCurriculumError() {
  return new OnboardingProfileError({
    code: onboardingCurriculumMissingCode,
    message: "The default curriculum is unavailable.",
  });
}

/** Reads one user's resumable onboarding profile. */
export const readOnboardingProfileByUserId = Effect.fn(
  "onboarding.readProfileByUserId"
)(function* (ctx: OnboardingCtx, userId: Id<"users">) {
  const database = DatabaseReader.make(databaseSchema, ctx.db);
  return yield* database
    .table("onboardingProfiles")
    .get("by_userId", userId)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie,
      Effect.catchDefect(flow(toOnboardingPersistenceError, Effect.fail))
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
  ctx: MutationCtx,
  user: Pick<Doc<"users">, "_id" | "role">
) {
  const writer = DatabaseWriter.make(databaseSchema, ctx.db);
  const profile = yield* readOnboardingProfileByUserId(ctx, user._id);
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
        Effect.orDie,
        Effect.catchDefect(flow(toOnboardingPersistenceError, Effect.fail))
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
        Effect.orDie,
        Effect.catchDefect(flow(toOnboardingPersistenceError, Effect.fail))
      );
  }
  const admittedProfile = yield* readOnboardingProfileByUserId(ctx, user._id);
  return toOnboardingStatus(user, admittedProfile);
});

/** Saves one draft answer without applying user settings early. */
export const saveOnboardingAnswer = Effect.fn("onboarding.saveAnswer")(
  function* (ctx: MutationCtx, userId: Id<"users">, answer: OnboardingAnswer) {
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
    const current = yield* readOnboardingProfileByUserId(ctx, userId);
    if (current?.completedAt !== undefined) {
      return yield* new OnboardingProfileError({
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
          Effect.orDie,
          Effect.catchDefect(flow(toOnboardingPersistenceError, Effect.fail))
        );
    } else {
      yield* writer
        .table("onboardingProfiles")
        .insert({
          ...values,
          userId,
        })
        .pipe(
          Effect.orDie,
          Effect.catchDefect(flow(toOnboardingPersistenceError, Effect.fail))
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
  ctx: MutationCtx,
  userId: Id<"users">,
  answers: OnboardingCompletion
) {
  const writer = DatabaseWriter.make(databaseSchema, ctx.db);
  const profile = yield* readOnboardingProfileByUserId(ctx, userId);
  if (profile?.completedAt !== undefined) {
    return yield* new OnboardingProfileError({
      code: onboardingAlreadyCompleteCode,
      message: "Onboarding is already complete.",
    });
  }
  const defaults = getOnboardingRegionDefaults(answers.region);
  const curriculum = yield* readCurriculumProgram(
    ctx,
    defaults.locale,
    defaults.curriculumProgramKey
  ).pipe(Effect.mapError(toOnboardingCurriculumError));
  if (!curriculum) {
    return yield* new OnboardingProfileError({
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
      Effect.orDie,
      Effect.catchDefect(flow(toOnboardingPersistenceError, Effect.fail))
    );
  yield* setPreferredCurriculumProgram({
    ctx,
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
        Effect.orDie,
        Effect.catchDefect(flow(toOnboardingPersistenceError, Effect.fail))
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
        Effect.orDie,
        Effect.catchDefect(flow(toOnboardingPersistenceError, Effect.fail))
      );
  }
  yield* activateWelcomeIntent(ctx, userId, defaults.locale).pipe(
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
