import { requireAuth } from "@repo/backend/confect/auth/session";
import {
  readActiveTryoutCountry,
  toTryoutCountryOption,
  upsertPreferredTryoutCountry,
} from "@repo/backend/confect/learningPreferences/impl";
import {
  CurriculumPreferenceAuthError,
  curriculumPreferenceAuthFailedCode,
  curriculumPreferenceAuthFailedMessage,
  TryoutPreferenceError,
  tryoutCountryNotFoundCode,
  tryoutPreferenceAuthFailedCode,
} from "@repo/backend/confect/learningPreferences/mutations.spec";
import { saveCurriculumProgram } from "@repo/backend/confect/learningPreferences/program";
import type { Locale } from "@repo/backend/confect/lib/validators/contents";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Clock, Effect } from "effect";

const tryoutPreferenceAuthFailedMessage =
  "Unable to authenticate the try-out preference request.";
/** Maps unknown curriculum auth failures into a stable public contract. */
function toCurriculumPreferenceAuthError() {
  return new CurriculumPreferenceAuthError({
    code: curriculumPreferenceAuthFailedCode,
    message: curriculumPreferenceAuthFailedMessage,
  });
}

/** Preserves shared session failures and redacts provider failures. */
function toTryoutPreferenceAuthError(
  error: Effect.Error<ReturnType<typeof requireAuth>>
) {
  if (error._tag !== "AuthReadError") {
    return new TryoutPreferenceError({
      code: error.code,
      message: error.message,
    });
  }
  return new TryoutPreferenceError({
    code: tryoutPreferenceAuthFailedCode,
    message: tryoutPreferenceAuthFailedMessage,
  });
}

/** Saves one authenticated curriculum preference from the signed catalog. */
export const setPreferredCurriculumProgram = Effect.fn(
  "learningPreferences.setPreferredCurriculum"
)(function* (
  ctx: MutationCtx,
  args: {
    readonly locale: Locale;
    readonly preferredCurriculumProgramKey: string;
  }
) {
  const user = yield* requireAuth(ctx).pipe(
    Effect.mapError(toCurriculumPreferenceAuthError)
  );
  return yield* saveCurriculumProgram(
    ctx,
    args.locale,
    args.preferredCurriculumProgramKey,
    user.appUser._id
  );
});

/** Saves one authenticated try-out country from the signed catalog. */
export const setPreferredTryoutCountryProgram = Effect.fn(
  "learningPreferences.setPreferredTryoutCountry"
)(function* (
  ctx: MutationCtx,
  args: {
    readonly locale: Locale;
    readonly preferredTryoutCountryKey: string;
  }
) {
  const user = yield* requireAuth(ctx).pipe(
    Effect.mapError(toTryoutPreferenceAuthError)
  );
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
