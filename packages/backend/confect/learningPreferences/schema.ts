import { failureWire } from "@repo/backend/confect/failure";
import { Schema } from "effect";
export const curriculumProgramOptionValidator = Schema.Struct({
  countryCode: Schema.optionalKey(Schema.String),
  key: Schema.String,
  publicSlug: Schema.String,
  title: Schema.String,
});
export const tryoutCountryOptionValidator = Schema.Struct({
  countryCode: Schema.String,
  key: Schema.String,
  publicPath: Schema.String,
  title: Schema.String,
});
export const currentLearningPreferenceValidator = Schema.Union([
  Schema.Null,
  Schema.Struct({
    preferredCurriculumProgramKey: Schema.String,
    program: curriculumProgramOptionValidator,
  }),
]);
export const currentTryoutPreferenceValidator = Schema.Union([
  Schema.Null,
  Schema.Struct({
    country: tryoutCountryOptionValidator,
    preferredTryoutCountryKey: Schema.String,
  }),
]);
export const learningPreferencePersistenceFailedCode =
  "LEARNING_PREFERENCE_PERSISTENCE_FAILED";
export const learningPreferencePersistenceFailedMessage =
  "Unable to read or persist learning preferences.";

/** Expected database failure while reading or writing learner preferences. */
export class LearningPreferencePersistenceError extends Schema.TaggedError<LearningPreferencePersistenceError>()(
  "LearningPreferencePersistenceError",
  {
    code: Schema.Literal(learningPreferencePersistenceFailedCode),
    message: Schema.Literal(learningPreferencePersistenceFailedMessage),
  }
) {}

/** Maps unknown database failures into the preference persistence contract. */
/** Public failure payload keeps the domain tag while preserving the deployed code/message transport. */
export const LearningPreferencePersistenceErrorWire = failureWire(
  LearningPreferencePersistenceError
);
export const curriculumPreferenceIoFailedCode =
  "CURRICULUM_PREFERENCE_IO_FAILED";
export const curriculumProgramNotFoundCode = "CURRICULUM_PROGRAM_NOT_FOUND";
/** Expected curriculum preference failure exposed through Convex errors. */
export class CurriculumPreferenceError extends Schema.TaggedError<CurriculumPreferenceError>()(
  "CurriculumPreferenceError",
  {
    code: Schema.Literals([
      curriculumPreferenceIoFailedCode,
      curriculumProgramNotFoundCode,
    ]),
    message: Schema.String,
  }
) {}
/** Compact curriculum option consumed by selectors and preference storage. */
/** Public failure payload keeps the domain tag while preserving the deployed code/message transport. */
export const CurriculumPreferenceErrorWire = failureWire(
  CurriculumPreferenceError
);
