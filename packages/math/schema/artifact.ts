import { MathCopyKeySchema } from "@repo/math/schema/copy";
import {
  StepProjectionLevelSchema,
  VerificationLaneSchema,
} from "@repo/math/schema/lane";
import { MathExpressionSchema } from "@repo/math/schema/shared";
import { Schema } from "effect";

/** Visual intent kinds that MathWork can hand to renderer adapters. */
export const visualIntentKindValues = [
  "coordinate-line",
  "coordinate-circle",
  "function-graph",
  "formula-card",
] as const;

/** Math-owned visualization intent; renderers decide how much to display now. */
export const VisualIntentSchema = Schema.Struct({
  descriptionKey: MathCopyKeySchema,
  expressions: Schema.Array(MathExpressionSchema).pipe(Schema.mutable),
  kind: Schema.Literal(...visualIntentKindValues),
  source: Schema.NonEmptyString,
  verificationLane: VerificationLaneSchema,
}).pipe(Schema.mutable);

export type VisualIntent = Schema.Schema.Type<typeof VisualIntentSchema>;

/** Render artifact kinds supported by the compact MathWork manifest. */
export const mathWorkArtifactKindValues = [
  "formula-card",
  "step-list",
  "assumptions",
  "visual-intent",
] as const;

/** Formula artifact manifest pointing at expressions already present on MathWork. */
const FormulaCardManifestSchema = Schema.Struct({
  expressionRefs: Schema.Array(Schema.NonEmptyString).pipe(Schema.mutable),
  kind: Schema.Literal("formula-card"),
}).pipe(Schema.mutable);

/** Step-list artifact manifest selecting ordered steps and projection depth. */
const StepListManifestSchema = Schema.Struct({
  kind: Schema.Literal("step-list"),
  projectionLevel: StepProjectionLevelSchema,
  stepOrders: Schema.Array(Schema.NonNegativeInt).pipe(Schema.mutable),
}).pipe(Schema.mutable);

/** Assumptions artifact manifest for future grouped note rendering. */
const AssumptionsManifestSchema = Schema.Struct({
  kind: Schema.Literal("assumptions"),
  limitationRefs: Schema.Array(Schema.NonEmptyString).pipe(Schema.mutable),
}).pipe(Schema.mutable);

/** Visual artifact manifest carrying structured renderer intent. */
const VisualIntentManifestSchema = Schema.Struct({
  kind: Schema.Literal("visual-intent"),
  visualIntent: VisualIntentSchema,
}).pipe(Schema.mutable);

/** Compact renderable projection manifest for one MathWork. */
export class MathWorkArtifact extends Schema.Class<MathWorkArtifact>(
  "MathWorkArtifact"
)({
  artifactId: Schema.NonEmptyString,
  kind: Schema.Literal(...mathWorkArtifactKindValues),
  manifest: Schema.Union(
    FormulaCardManifestSchema,
    StepListManifestSchema,
    AssumptionsManifestSchema,
    VisualIntentManifestSchema
  ),
  titleKey: MathCopyKeySchema,
  verificationLane: VerificationLaneSchema,
  workId: Schema.NonEmptyString,
}) {}

export type MathWorkArtifactEncoded = Schema.Schema.Encoded<
  typeof MathWorkArtifact
>;
