import { requireAuth } from "@repo/backend/confect/auth/session";
import {
  readActiveTryoutCountry,
  toTryoutCountryOption,
  upsertPreferredTryoutCountry,
} from "@repo/backend/confect/learningPreferences/impl";
import {
  TryoutPreferenceError,
  tryoutCountryNotFoundCode,
} from "@repo/backend/confect/learningPreferences/mutations.spec";
import { saveCurriculumProgram } from "@repo/backend/confect/learningPreferences/program";
import type { Locale } from "@repo/backend/confect/lib/validators/contents";
import { Clock, Effect } from "effect";

/** Saves one authenticated curriculum preference from the signed catalog. */
export const setPreferredCurriculumProgram = Effect.fn(
  "learningPreferences.setPreferredCurriculum"
)(function* (args: {
  readonly locale: Locale;
  readonly preferredCurriculumProgramKey: string;
}) {
  const user = yield* requireAuth();
  return yield* saveCurriculumProgram(
    args.locale,
    args.preferredCurriculumProgramKey,
    user.appUser._id
  );
});

/** Saves one authenticated try-out country from the signed catalog. */
export const setPreferredTryoutCountryProgram = Effect.fn(
  "learningPreferences.setPreferredTryoutCountry"
)(function* (args: {
  readonly locale: Locale;
  readonly preferredTryoutCountryKey: string;
}) {
  const user = yield* requireAuth();
  const country = yield* readActiveTryoutCountry({
    countryKey: args.preferredTryoutCountryKey,
    locale: args.locale,
  });
  if (!country) {
    return yield* TryoutPreferenceError.make({
      code: tryoutCountryNotFoundCode,
      message: "Try-out country not found.",
    });
  }
  const now = yield* Clock.currentTimeMillis;
  yield* upsertPreferredTryoutCountry({
    countryKey: country.countryKey,
    now,
    userId: user.appUser._id,
  });
  return {
    country: toTryoutCountryOption(country),
    preferredTryoutCountryKey: country.countryKey,
  };
});
