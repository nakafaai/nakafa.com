import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseErrorWire } from "@repo/backend/confect/contentRelease/error";
import { failureWire } from "@repo/backend/confect/failure";
import {
  CurriculumPreferenceErrorWire,
  currentLearningPreferenceValidator,
  currentTryoutPreferenceValidator,
  LearningPreferencePersistenceErrorWire,
} from "@repo/backend/confect/learningPreferences/schema";
import { localeValidator } from "@repo/backend/confect/lib/validators/contents";
import { tryoutRouteKeyValidator } from "@repo/backend/confect/tryouts/route";
import { Schema } from "effect";
export const curriculumPreferenceAuthFailedCode =
  "CURRICULUM_PREFERENCE_AUTH_FAILED";
export const curriculumPreferenceAuthFailedMessage =
  "Unable to authenticate the curriculum preference request.";
export const tryoutPreferenceAuthFailedCode = "TRYOUT_PREFERENCE_AUTH_FAILED";
export const tryoutCountryNotFoundCode = "TRYOUT_COUNTRY_NOT_FOUND";
export const unauthenticatedCode = "UNAUTHENTICATED";
export const unauthorizedCode = "UNAUTHORIZED";

/** Raised when curriculum preference authentication fails unexpectedly. */
export class CurriculumPreferenceAuthError extends Schema.TaggedError<CurriculumPreferenceAuthError>()(
  "CurriculumPreferenceAuthError",
  {
    code: Schema.Literal(curriculumPreferenceAuthFailedCode),
    message: Schema.Literal(curriculumPreferenceAuthFailedMessage),
  }
) {}

/** Raised when a try-out preference mutation cannot be completed safely. */
/** Public failure payload keeps the domain tag while preserving the deployed code/message transport. */
export const CurriculumPreferenceAuthErrorWire = failureWire(
  CurriculumPreferenceAuthError
);
/** Raised when a try-out preference mutation cannot be completed safely. */
export class TryoutPreferenceError extends Schema.TaggedError<TryoutPreferenceError>()(
  "TryoutPreferenceError",
  {
    code: Schema.Literals([
      tryoutPreferenceAuthFailedCode,
      tryoutCountryNotFoundCode,
      unauthenticatedCode,
      unauthorizedCode,
    ]),
    message: Schema.String,
  }
) {}

/** Maps unknown curriculum auth failures into a stable public contract. */
/** Public failure payload keeps the domain tag while preserving the deployed code/message transport. */
export const TryoutPreferenceErrorWire = failureWire(TryoutPreferenceError);
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
          CurriculumPreferenceAuthErrorWire,
          ReleaseErrorWire,
          CurriculumPreferenceErrorWire,
          LearningPreferencePersistenceErrorWire,
        ]),
    })
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
          TryoutPreferenceErrorWire,
          ReleaseErrorWire,
          LearningPreferencePersistenceErrorWire,
        ]),
    })
  );
