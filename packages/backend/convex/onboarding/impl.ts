import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { setPreferredCurriculumProgram } from "@repo/backend/convex/learningPreferences/impl";
import { readCurriculumProgram } from "@repo/backend/convex/learningPreferences/program";
import type {
  OnboardingCompletion,
  OnboardingFocus,
  OnboardingRegion,
  onboardingAnswerValidator,
} from "@repo/backend/convex/onboarding/schema";
import {
  getOnboardingDestination,
  getOnboardingRegionDefaults,
} from "@repo/backend/convex/onboarding/spec";
import type { SelfSelectableUserRole } from "@repo/backend/convex/users/roles";
import type { Infer } from "convex/values";
import { Clock, Effect, Schema } from "effect";

type OnboardingAnswer = Infer<typeof onboardingAnswerValidator>;
type OnboardingCtx = MutationCtx | QueryCtx;
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

/** Projects one private database row into the public draft shape. */
export function toOnboardingProfile(profile: {
  readonly completedAt?: number;
  readonly focus?: OnboardingFocus;
  readonly region?: OnboardingRegion;
  readonly role?: SelfSelectableUserRole;
  readonly updatedAt: number;
}) {
  return {
    ...(profile.completedAt === undefined
      ? {}
      : { completedAt: profile.completedAt }),
    ...(profile.focus === undefined ? {} : { focus: profile.focus }),
    ...(profile.region === undefined ? {} : { region: profile.region }),
    ...(profile.role === undefined ? {} : { role: profile.role }),
    updatedAt: profile.updatedAt,
  };
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
  const base = { updatedAt: now, userId };

  if (answer.kind === "role") {
    return ctx.db.insert("onboardingProfiles", {
      ...base,
      role: answer.value,
    });
  }

  if (answer.kind === "region") {
    return ctx.db.insert("onboardingProfiles", {
      ...base,
      region: answer.value,
    });
  }

  return ctx.db.insert("onboardingProfiles", {
    ...base,
    focus: answer.value,
  });
}

/** Patches exactly one answer on an incomplete onboarding profile. */
function patchOnboardingAnswer(
  ctx: MutationCtx,
  profileId: Id<"onboardingProfiles">,
  answer: OnboardingAnswer,
  now: number
) {
  if (answer.kind === "role") {
    return ctx.db.patch(profileId, { role: answer.value, updatedAt: now });
  }

  if (answer.kind === "region") {
    return ctx.db.patch(profileId, { region: answer.value, updatedAt: now });
  }

  return ctx.db.patch(profileId, { focus: answer.value, updatedAt: now });
}

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
    if (current) {
      yield* tryOnboardingPersistence(() =>
        patchOnboardingAnswer(ctx, current._id, answer, now)
      );
    } else {
      yield* tryOnboardingPersistence(() =>
        insertOnboardingAnswer(ctx, userId, answer, now)
      );
    }

    const saved = yield* readOnboardingProfileByUserId(ctx, userId);
    if (!saved) {
      return yield* toOnboardingPersistenceError();
    }
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
  const curriculum = defaults.curriculumProgramKey
    ? yield* readCurriculumProgram(
        ctx,
        defaults.locale,
        defaults.curriculumProgramKey
      ).pipe(Effect.mapError(toOnboardingCurriculumError))
    : null;
  if (defaults.curriculumProgramKey && !curriculum) {
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
    programKey: curriculum?.key ?? null,
    userId,
  }).pipe(Effect.mapError(toOnboardingPersistenceError));

  if (profile) {
    yield* tryOnboardingPersistence(() =>
      ctx.db.patch(profile._id, {
        ...answers,
        completedAt: now,
        updatedAt: now,
      })
    );
  } else {
    yield* tryOnboardingPersistence(() =>
      ctx.db.insert("onboardingProfiles", {
        ...answers,
        completedAt: now,
        updatedAt: now,
        userId,
      })
    );
  }

  return {
    destination: getOnboardingDestination({
      focus: answers.focus,
      ...(curriculum ? { publicSlug: curriculum.publicSlug } : {}),
    }),
    locale: defaults.locale,
  };
});
