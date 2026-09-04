import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { setPreferredCurriculumProgram } from "@repo/backend/convex/learningPreferences/impl";
import { readCurriculumProgram } from "@repo/backend/convex/learningPreferences/program";
import type {
  OnboardingCompletion,
  onboardingAnswerValidator,
} from "@repo/backend/convex/onboarding/schema";
import {
  getOnboardingDestination,
  getOnboardingRegionDefaults,
} from "@repo/backend/convex/onboarding/spec";
import {
  toOnboardingProfile,
  toOnboardingStatus,
} from "@repo/backend/convex/onboarding/status";
import type { Infer } from "convex/values";
import { Clock, Effect, Schema } from "effect";

type OnboardingAnswer = Infer<typeof onboardingAnswerValidator>;
type OnboardingCtx = MutationCtx | QueryCtx;
type OnboardingProfile = Doc<"onboardingProfiles">;
const onboardingAlreadyCompleteCode = "ONBOARDING_ALREADY_COMPLETE";
const onboardingPersistenceFailedCode = "ONBOARDING_PERSISTENCE_FAILED";
const onboardingPersistenceFailedMessage =
  "Unable to read or persist onboarding progress.";
const onboardingCurriculumMissingCode = "ONBOARDING_CURRICULUM_MISSING";

/** Expected failure while reading, saving, or completing onboarding. */
export class OnboardingProfileError extends Schema.TaggedError<OnboardingProfileError>()(
  "OnboardingProfileError",
  {
    code: Schema.Literals([
      onboardingAlreadyCompleteCode,
      onboardingCurriculumMissingCode,
      onboardingPersistenceFailedCode,
    ]),
    message: Schema.String,
  }
) {}

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

/** Runs one onboarding database operation through its typed error channel. */
function tryOnboardingPersistence<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({
    catch: toOnboardingPersistenceError,
    try: operation,
  });
}

/** Reads one user's resumable onboarding profile. */
export const readOnboardingProfileByUserId = Effect.fn(
  "onboarding.readProfileByUserId"
)(function* (ctx: OnboardingCtx, userId: Id<"users">) {
  return yield* tryOnboardingPersistence(() =>
    ctx.db
      .query("onboardingProfiles")
      .withIndex("by_userId", (query) => query.eq("userId", userId))
      .unique()
  );
});

/** Inserts the first answer for one onboarding profile. */
function insertOnboardingAnswer(
  ctx: MutationCtx,
  userId: Id<"users">,
  answer: OnboardingAnswer,
  now: number
) {
  const base = {
    admittedAt: now,
    startedAt: now,
    updatedAt: now,
    userId,
  };

  if (answer.kind === "role") {
    const profile = {
      ...base,
      role: answer.value,
    };
    return tryOnboardingPersistence(() =>
      ctx.db.insert("onboardingProfiles", profile)
    ).pipe(Effect.as(profile));
  }

  if (answer.kind === "region") {
    const profile = {
      ...base,
      region: answer.value,
    };
    return tryOnboardingPersistence(() =>
      ctx.db.insert("onboardingProfiles", profile)
    ).pipe(Effect.as(profile));
  }

  const profile = {
    ...base,
    focus: answer.value,
  };
  return tryOnboardingPersistence(() =>
    ctx.db.insert("onboardingProfiles", profile)
  ).pipe(Effect.as(profile));
}

/** Patches exactly one answer on an incomplete onboarding profile. */
function patchOnboardingAnswer(
  ctx: MutationCtx,
  profile: OnboardingProfile,
  answer: OnboardingAnswer,
  now: number
) {
  const lifecycle = {
    ...(profile.admittedAt === undefined ? { admittedAt: now } : {}),
    ...(profile.startedAt === undefined ? { startedAt: now } : {}),
    updatedAt: now,
  };

  if (answer.kind === "role") {
    const saved = { ...profile, ...lifecycle, role: answer.value };
    return tryOnboardingPersistence(() =>
      ctx.db.patch(profile._id, { ...lifecycle, role: answer.value })
    ).pipe(Effect.as(saved));
  }

  if (answer.kind === "region") {
    const saved = { ...profile, ...lifecycle, region: answer.value };
    return tryOnboardingPersistence(() =>
      ctx.db.patch(profile._id, { ...lifecycle, region: answer.value })
    ).pipe(Effect.as(saved));
  }

  const saved = { ...profile, ...lifecycle, focus: answer.value };
  return tryOnboardingPersistence(() =>
    ctx.db.patch(profile._id, { ...lifecycle, focus: answer.value })
  ).pipe(Effect.as(saved));
}

/** Records the first authoritative decision requiring user onboarding. */
export const admitOnboarding = Effect.fn("onboarding.admit")(function* (
  ctx: MutationCtx,
  user: Pick<Doc<"users">, "_id" | "role">
) {
  const profile = yield* readOnboardingProfileByUserId(ctx, user._id);
  const status = toOnboardingStatus(user, profile);
  if (!status.isRequired || profile?.admittedAt !== undefined) {
    return status;
  }

  const now = yield* Clock.currentTimeMillis;
  if (profile) {
    yield* tryOnboardingPersistence(() =>
      ctx.db.patch(profile._id, { admittedAt: now })
    );
  } else {
    yield* tryOnboardingPersistence(() =>
      ctx.db.insert("onboardingProfiles", {
        admittedAt: now,
        updatedAt: now,
        userId: user._id,
      })
    );
  }

  const admittedProfile = yield* readOnboardingProfileByUserId(ctx, user._id);
  return toOnboardingStatus(user, admittedProfile);
});

/** Saves one draft answer without applying user settings early. */
export const saveOnboardingAnswer = Effect.fn("onboarding.saveAnswer")(
  function* (ctx: MutationCtx, userId: Id<"users">, answer: OnboardingAnswer) {
    const current = yield* readOnboardingProfileByUserId(ctx, userId);
    if (current?.completedAt !== undefined) {
      return yield* new OnboardingProfileError({
        code: onboardingAlreadyCompleteCode,
        message: "Onboarding is already complete.",
      });
    }

    const now = yield* Clock.currentTimeMillis;
    const saved = yield* current
      ? patchOnboardingAnswer(ctx, current, answer, now)
      : insertOnboardingAnswer(ctx, userId, answer, now);
    return toOnboardingProfile(saved);
  }
);

/** Applies every onboarding answer and returns the first app destination. */
export const finishOnboarding = Effect.fn("onboarding.finish")(function* (
  ctx: MutationCtx,
  userId: Id<"users">,
  answers: OnboardingCompletion
) {
  const profile = yield* readOnboardingProfileByUserId(ctx, userId);
  if (profile?.completedAt !== undefined) {
    return yield* new OnboardingProfileError({
      code: onboardingAlreadyCompleteCode,
      message: "Onboarding is already complete.",
    });
  }

  const defaults = getOnboardingRegionDefaults(answers.region);
  const curriculumProgramKey = yield* Effect.fromNullishOr(
    defaults.curriculumProgramKey
  ).pipe(Effect.mapError(toOnboardingCurriculumError));
  const curriculum = yield* readCurriculumProgram(
    ctx,
    defaults.locale,
    curriculumProgramKey
  ).pipe(Effect.mapError(toOnboardingCurriculumError));
  if (!curriculum) {
    return yield* new OnboardingProfileError({
      code: onboardingCurriculumMissingCode,
      message: "The default curriculum is unavailable.",
    });
  }

  const now = yield* Clock.currentTimeMillis;
  yield* tryOnboardingPersistence(() =>
    ctx.db.patch("users", userId, { role: answers.role })
  );

  yield* setPreferredCurriculumProgram({
    ctx,
    now,
    programKey: curriculum.key,
    userId,
  }).pipe(Effect.mapError(toOnboardingPersistenceError));

  if (profile) {
    yield* tryOnboardingPersistence(() =>
      ctx.db.patch(profile._id, {
        ...answers,
        admittedAt: profile.admittedAt ?? now,
        completedAt: now,
        startedAt: profile.startedAt ?? now,
        updatedAt: now,
      })
    );
  } else {
    yield* tryOnboardingPersistence(() =>
      ctx.db.insert("onboardingProfiles", {
        ...answers,
        admittedAt: now,
        completedAt: now,
        startedAt: now,
        updatedAt: now,
        userId,
      })
    );
  }

  return {
    destination: getOnboardingDestination({
      focus: answers.focus,
      publicSlug: curriculum.publicSlug,
    }),
    locale: defaults.locale,
  };
});
