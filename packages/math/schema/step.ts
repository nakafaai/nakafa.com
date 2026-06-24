import { MathCopyKeySchema, MathCopyValueSchema } from "@repo/math/schema/copy";
import {
  StepProjectionLevelSchema,
  VerificationLaneSchema,
} from "@repo/math/schema/lane";
import { MathExpressionSchema } from "@repo/math/schema/shared";
import { Schema } from "effect";

const StepProjectionCopySchema = Schema.Struct({
  key: MathCopyKeySchema,
  values: Schema.Array(MathCopyValueSchema).pipe(Schema.mutable),
}).pipe(Schema.mutable);

const StepProjectionSchema = Schema.Struct({
  advanced: StepProjectionCopySchema,
  atomic: StepProjectionCopySchema,
  professor: StepProjectionCopySchema,
  school: StepProjectionCopySchema,
}).pipe(Schema.mutable);

/** One ordered semantic derivation step in a canonical MathWork. */
export class MathWorkStep extends Schema.Class<MathWorkStep>("MathWorkStep")({
  input: MathExpressionSchema,
  order: Schema.NonNegativeInt,
  output: MathExpressionSchema,
  projection: StepProjectionSchema,
  projectionLevels: Schema.Array(StepProjectionLevelSchema).pipe(
    Schema.mutable
  ),
  ruleId: Schema.NonEmptyString,
  verificationLane: VerificationLaneSchema,
  workId: Schema.NonEmptyString,
}) {}

export type MathWorkStepEncoded = Schema.Schema.Encoded<typeof MathWorkStep>;
export type MathWorkStepShape = Schema.Schema.Type<typeof MathWorkStep>;
