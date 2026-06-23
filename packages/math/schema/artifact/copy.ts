import { Schema } from "effect";

/** Maximum student-facing title length accepted for durable artifact copy. */
export const MAX_LEARNING_ARTIFACT_TITLE_LENGTH = 180;

/** Maximum student-facing description length accepted for durable artifact copy. */
export const MAX_LEARNING_ARTIFACT_DESCRIPTION_LENGTH = 500;

/** Student-facing artifact title proposed by the model and bounded by schema. */
export const LearningArtifactTitleSchema = Schema.NonEmptyString.pipe(
  Schema.pattern(/\S/),
  Schema.maxLength(MAX_LEARNING_ARTIFACT_TITLE_LENGTH)
);

/** Student-facing artifact description that may include bounded inline math. */
export const LearningArtifactDescriptionSchema = Schema.NonEmptyString.pipe(
  Schema.pattern(/\S/),
  Schema.maxLength(MAX_LEARNING_ARTIFACT_DESCRIPTION_LENGTH)
);

/** LLM-authored display copy for artifacts whose geometry remains deterministic. */
export class LearningArtifactDisplayCopy extends Schema.Class<LearningArtifactDisplayCopy>(
  "LearningArtifactDisplayCopy"
)({
  description: LearningArtifactDescriptionSchema,
  title: LearningArtifactTitleSchema,
}) {}
