import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseErrorWire } from "@repo/backend/confect/contentRelease/error";
import { failureWire } from "@repo/backend/confect/failure";
import {
  CurriculumPreferenceErrorWire,
  currentLearningPreferenceValidator,
  currentTryoutPreferenceValidator,
  curriculumProgramOptionValidator,
  LearningPreferencePersistenceErrorWire,
} from "@repo/backend/confect/learningPreferences/schema";
import { localeValidator } from "@repo/backend/confect/lib/validators/contents";
import { Schema } from "effect";
export const learningPreferenceIoFailedCode = "LEARNING_PREFERENCE_IO_FAILED";
export const learningPreferenceIoFailedMessage =
  "Unable to read learning preferences.";

/** Raised when an authenticated preference query cannot read its user. */
export class LearningPreferenceIoError extends Schema.TaggedError<LearningPreferenceIoError>()(
  "LearningPreferenceIoError",
  {
    code: Schema.Literal(learningPreferenceIoFailedCode),
    message: Schema.Literal(learningPreferenceIoFailedMessage),
  }
) {}

/** Maps unknown authentication reads into the preference error channel. */
/** Public failure payload keeps the domain tag while preserving the deployed code/message transport. */
export const LearningPreferenceIoErrorWire = failureWire(
  LearningPreferenceIoError
);
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "listCurriculumPrograms",
      args: () => ({
        locale: localeValidator,
      }),
      returns: () =>
        Schema.mutable(Schema.Array(curriculumProgramOptionValidator)),
      error: () =>
        Schema.Union([ReleaseErrorWire, CurriculumPreferenceErrorWire]),
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getCurrent",
      args: () => ({
        locale: localeValidator,
      }),
      returns: () => currentLearningPreferenceValidator,
      error: () =>
        Schema.Union([
          LearningPreferenceIoErrorWire,
          LearningPreferencePersistenceErrorWire,
          CurriculumPreferenceErrorWire,
          ReleaseErrorWire,
        ]),
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getCurrentTryout",
      args: () => ({
        locale: localeValidator,
      }),
      returns: () => currentTryoutPreferenceValidator,
      error: () =>
        Schema.Union([
          LearningPreferenceIoErrorWire,
          LearningPreferencePersistenceErrorWire,
          ReleaseErrorWire,
        ]),
    })
  );
