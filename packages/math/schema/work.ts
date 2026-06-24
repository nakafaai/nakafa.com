import { MathWorkArtifact } from "@repo/math/schema/artifact";
import { MathCopyKeySchema, MathCopyValueSchema } from "@repo/math/schema/copy";
import { VerificationLaneSchema } from "@repo/math/schema/lane";
import { MathOperationSchema } from "@repo/math/schema/operations";
import { MathRequestSchema } from "@repo/math/schema/request";
import {
  MathExpressionSchema,
  MathItemSchema,
  MathStepSchema,
} from "@repo/math/schema/shared";
import {
  MathStatusSchema,
  MathStepStatusSchema,
} from "@repo/math/schema/status";
import { MathWorkStep } from "@repo/math/schema/step";
import { Schema } from "effect";

/** Canonical MathWork availability states used before localized projection. */
export const mathWorkStatusValues = ["ready", "limited", "failed"] as const;

/** Request accepted by the public MathReasoning Interface. */
export class MathReasoningRequest extends Schema.Class<MathReasoningRequest>(
  "MathReasoningRequest"
)({
  givens: Schema.Array(Schema.NonEmptyString).pipe(Schema.mutable),
  locale: Schema.String,
  math: Schema.optional(MathRequestSchema),
  objective: Schema.NonEmptyString,
  persistence: Schema.Literal("none", "persist"),
  projectionLevel: Schema.optional(
    Schema.Literal("atomic", "school", "advanced", "professor")
  ),
  request: Schema.NonEmptyString,
  requirements: Schema.optionalWith(
    Schema.Array(Schema.NonEmptyString).pipe(Schema.mutable),
    { default: () => [] }
  ),
  responseMessageIdentifier: Schema.optional(Schema.NonEmptyString),
  toolCallId: Schema.optional(Schema.NonEmptyString),
}) {}

/** Learner prompt fields retained as semantic MathWork input, not transcript text. */
const MathWorkInputSchema = Schema.Struct({
  givens: Schema.Array(Schema.NonEmptyString).pipe(Schema.mutable),
  kind: Schema.Literal("prompt"),
  locale: Schema.String,
  objective: Schema.NonEmptyString,
  requirements: Schema.optionalWith(
    Schema.Array(Schema.NonEmptyString).pipe(Schema.mutable),
    { default: () => [] }
  ),
  text: Schema.NonEmptyString,
}).pipe(Schema.mutable);

/** Verification metadata for the answer lane and localization reason key. */
const MathWorkVerificationSchema = Schema.Struct({
  engine: Schema.NonEmptyString,
  lane: VerificationLaneSchema,
  reasonKey: MathCopyKeySchema,
  source: Schema.NonEmptyString,
  values: Schema.Array(MathCopyValueSchema).pipe(Schema.mutable),
}).pipe(Schema.mutable);

/** Semantic note stored as copy key and interpolation data. */
const MathWorkNoteSchema = Schema.Struct({
  copyKey: MathCopyKeySchema,
  lane: VerificationLaneSchema,
  source: Schema.optional(Schema.NonEmptyString),
  values: Schema.Array(MathCopyValueSchema).pipe(Schema.mutable),
}).pipe(Schema.mutable);

/** Canonical computation evidence without CAS explanatory prose. */
export const MathComputationSchema = Schema.Struct({
  conditions: Schema.Array(MathExpressionSchema).pipe(Schema.mutable),
  input: MathRequestSchema,
  items: Schema.Array(MathItemSchema).pipe(Schema.mutable),
  kind: MathOperationSchema,
  operation: MathOperationSchema,
  primary: MathExpressionSchema,
  secondary: Schema.optional(MathExpressionSchema),
  stepStatus: MathStepStatusSchema,
  steps: Schema.Array(MathStepSchema).pipe(Schema.mutable),
  status: MathStatusSchema,
}).pipe(Schema.mutable);

/** Canonical durable evidence object for one Nina math answer. */
export class MathWork extends Schema.Class<MathWork>("MathWork")({
  assumptions: Schema.Array(MathWorkNoteSchema).pipe(Schema.mutable),
  computations: Schema.Array(MathComputationSchema).pipe(Schema.mutable),
  createdAt: Schema.Number,
  input: MathWorkInputSchema,
  limitations: Schema.Array(MathWorkNoteSchema).pipe(Schema.mutable),
  plannedRequest: MathRequestSchema,
  primaryResult: MathExpressionSchema,
  status: Schema.Literal(...mathWorkStatusValues),
  verification: MathWorkVerificationSchema,
  workId: Schema.NonEmptyString,
}) {}

/** Full MathReasoning output for Nina, persistence, tests, and UI projection. */
export class MathWorkResult extends Schema.Class<MathWorkResult>(
  "MathWorkResult"
)({
  artifacts: Schema.Array(MathWorkArtifact).pipe(Schema.mutable),
  steps: Schema.Array(MathWorkStep).pipe(Schema.mutable),
  work: MathWork,
}) {}

export type MathReasoningRequestShape = Schema.Schema.Type<
  typeof MathReasoningRequest
>;
export type MathWorkShape = Schema.Schema.Type<typeof MathWork>;
export type MathWorkResultShape = Schema.Schema.Type<typeof MathWorkResult>;
export type MathWorkResultEncoded = Schema.Schema.Encoded<
  typeof MathWorkResult
>;
export type MathComputation = Schema.Schema.Type<typeof MathComputationSchema>;
