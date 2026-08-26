import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { mutation } from "@repo/backend/convex/functions";
import {
  readActiveTryoutCountry,
  toTryoutCountryOption,
  upsertPreferredTryoutCountry,
} from "@repo/backend/convex/learningPreferences/impl";
import { saveCurriculumProgram } from "@repo/backend/convex/learningPreferences/program";
import {
  currentLearningPreferenceValidator,
  currentTryoutPreferenceValidator,
} from "@repo/backend/convex/learningPreferences/schema";
import {
  getUnknownErrorMessage,
  runConvexProgram,
} from "@repo/backend/convex/lib/effect";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import {
  type Locale,
  localeValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { tryoutRouteKeyValidator } from "@repo/backend/convex/tryouts/route";
import { v } from "convex/values";
import { Clock, Effect, Schema } from "effect";

const curriculumPreferenceAuthFailedCode = "CURRICULUM_PREFERENCE_AUTH_FAILED";
const tryoutPreferenceAuthFailedCode = "TRYOUT_PREFERENCE_AUTH_FAILED";
const tryoutCountryNotFoundCode = "TRYOUT_COUNTRY_NOT_FOUND";

/** Raised when curriculum preference authentication fails unexpectedly. */
class CurriculumPreferenceAuthError extends Schema.TaggedError<CurriculumPreferenceAuthError>()(
  "CurriculumPreferenceAuthError",
  {
    code: Schema.Literal(curriculumPreferenceAuthFailedCode),
    message: Schema.String,
  }
) {}

/** Raised when a try-out preference mutation cannot be completed safely. */
class TryoutPreferenceError extends Schema.TaggedError<TryoutPreferenceError>()(
  "TryoutPreferenceError",
  {
    code: Schema.Literals([
      tryoutPreferenceAuthFailedCode,
      tryoutCountryNotFoundCode,
    ]),
    message: Schema.String,
  }
) {}

/** Saves one authenticated curriculum preference from the signed catalog. */
const setPreferredCurriculumProgram = Effect.fn(
  "learningPreferences.setPreferredCurriculum"
)(function* (
  ctx: MutationCtx,
  args: {
    readonly locale: Locale;
    readonly preferredCurriculumProgramKey: string;
  }
) {
  const user = yield* Effect.tryPromise({
    catch: (error) =>
      new CurriculumPreferenceAuthError({
        code: curriculumPreferenceAuthFailedCode,
        message: getUnknownErrorMessage(error),
      }),
    try: () => requireAuth(ctx),
  });

  return yield* saveCurriculumProgram(
    ctx,
    args.locale,
    args.preferredCurriculumProgramKey,
    user.appUser._id
  );
});

/** Saves one authenticated try-out country from the signed catalog. */
const setPreferredTryoutCountryProgram = Effect.fn(
  "learningPreferences.setPreferredTryoutCountry"
)(function* (
  ctx: MutationCtx,
  args: {
    readonly locale: Locale;
    readonly preferredTryoutCountryKey: string;
  }
) {
  const user = yield* Effect.tryPromise({
    catch: (error) =>
      new TryoutPreferenceError({
        code: tryoutPreferenceAuthFailedCode,
        message: getUnknownErrorMessage(error),
      }),
    try: () => requireAuth(ctx),
  });
  const country = yield* readActiveTryoutCountry(ctx, {
    countryKey: args.preferredTryoutCountryKey,
    locale: args.locale,
  });

  if (!country) {
    return yield* new TryoutPreferenceError({
      code: tryoutCountryNotFoundCode,
      message: "Try-out country not found.",
    });
  }

  const now = yield* Clock.currentTimeMillis;
  yield* upsertPreferredTryoutCountry({
    countryKey: country.countryKey,
    ctx,
    now,
    userId: user.appUser._id,
  });

  return {
    country: toTryoutCountryOption(country),
    preferredTryoutCountryKey: country.countryKey,
  };
});

/** Saves the authenticated user's preferred school curriculum program. */
export const setPreferredCurriculum = mutation({
  args: {
    locale: localeValidator,
    preferredCurriculumProgramKey: v.string(),
  },
  returns: currentLearningPreferenceValidator,
  handler: (ctx, args) =>
    runConvexProgram(setPreferredCurriculumProgram(ctx, args)),
});

/** Saves the authenticated user's preferred try-out country. */
export const setPreferredTryoutCountry = mutation({
  args: {
    locale: localeValidator,
    preferredTryoutCountryKey: tryoutRouteKeyValidator,
  },
  returns: currentTryoutPreferenceValidator,
  handler: (ctx, args) =>
    runConvexProgram(setPreferredTryoutCountryProgram(ctx, args)),
});
