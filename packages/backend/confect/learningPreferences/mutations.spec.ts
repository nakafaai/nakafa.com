import { FunctionSpec, GroupSpec } from "@confect/core";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import {
  CurriculumPreferenceError,
  currentLearningPreferenceValidator,
  currentTryoutPreferenceValidator,
  LearningPreferencePersistenceError,
} from "@repo/backend/confect/learningPreferences/schema";
import { localeValidator } from "@repo/backend/confect/lib/validators/contents";
import Session from "@repo/backend/confect/middleware/session.spec";
import { tryoutRouteKeyValidator } from "@repo/backend/confect/tryouts/route";
import { Schema } from "effect";
export const tryoutCountryNotFoundCode = "TRYOUT_COUNTRY_NOT_FOUND";
/** The selected try-out country is absent from the active signed catalog. */
export class TryoutPreferenceError extends Schema.TaggedError<TryoutPreferenceError>()(
  "TryoutPreferenceError",
  {
    code: Schema.Literal(tryoutCountryNotFoundCode),
    message: Schema.String,
  }
) {}

export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicMutation({
      name: "setPreferredCurriculum",
      args: () => ({
        locale: localeValidator,
        preferredCurriculumProgramKey: Schema.String,
      }),
      returns: () => currentLearningPreferenceValidator,
      error: () =>
        Schema.Union([
          AuthFailure,
          ReleaseError,
          CurriculumPreferenceError,
          LearningPreferencePersistenceError,
        ]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "setPreferredTryoutCountry",
      args: () => ({
        locale: localeValidator,
        preferredTryoutCountryKey: tryoutRouteKeyValidator,
      }),
      returns: () => currentTryoutPreferenceValidator,
      error: () =>
        Schema.Union([
          AuthFailure,
          TryoutPreferenceError,
          ReleaseError,
          LearningPreferencePersistenceError,
        ]),
    }).middleware(Session)
  );
