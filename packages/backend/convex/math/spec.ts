import {
  mathWorkArtifactKindValues,
  visualIntentKindValues,
} from "@repo/math/schema/artifact";
import { mathCopyKeyValues } from "@repo/math/schema/copy";
import {
  stepProjectionLevelValues,
  verificationLaneValues,
} from "@repo/math/schema/lane";
import { mathOperations } from "@repo/math/schema/operations";
import {
  mathStatusValues,
  mathStepStatusValues,
} from "@repo/math/schema/status";
import { mathWorkStatusValues } from "@repo/math/schema/work";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

/** Deterministic math operation validator derived from the math package. */
export const mathOperationValidator = literals(...mathOperations);

/** Verification lane validator derived from the math package. */
export const verificationLaneValidator = literals(...verificationLaneValues);

/** MathWork status validator derived from the math package. */
export const mathWorkStatusValidator = literals(...mathWorkStatusValues);

/** MathWork projection level validator derived from the math package. */
export const stepProjectionLevelValidator = literals(
  ...stepProjectionLevelValues
);

/** Math copy key validator derived from the math package. */
export const mathCopyKeyValidator = literals(...mathCopyKeyValues);

/** CAS computation status validator derived from the math package. */
export const mathStatusValidator = literals(...mathStatusValues);

/** CAS step availability validator derived from the math package. */
export const mathStepStatusValidator = literals(...mathStepStatusValues);

/** MathWork artifact kind validator derived from the math package. */
export const mathWorkArtifactKindValidator = literals(
  ...mathWorkArtifactKindValues
);

/** Exact math expression and rendered LaTeX pair. */
export const mathExpressionValidator = v.object({
  expression: v.string(),
  latex: v.string(),
});

/** Interpolation value passed from semantic math evidence to localization. */
export const mathCopyValueValidator = v.object({
  name: v.string(),
  value: v.string(),
});

/** Coordinate point encoded as exact string coordinates. */
export const mathPointValidator = v.object({
  x: v.string(),
  y: v.string(),
});

/** Probability operation parameters accepted by the CAS request contract. */
export const mathProbabilityParametersValidator = v.object({
  lambda: v.optional(v.string()),
  lower: v.optional(v.string()),
  mean: v.optional(v.string()),
  n: v.optional(v.string()),
  p: v.optional(v.string()),
  standard_deviation: v.optional(v.string()),
  upper: v.optional(v.string()),
});

/** CAS request validator aligned with MathRequestSchema. */
export const mathRequestValidator = v.object({
  distribution: v.optional(v.string()),
  expression: v.optional(v.string()),
  expressions: v.optional(v.array(v.string())),
  inclusive: v.optional(v.boolean()),
  k: v.optional(v.string()),
  kind: v.literal("math"),
  left: v.optional(v.string()),
  lower: v.optional(v.string()),
  lowerInclusive: v.optional(v.boolean()),
  matrix: v.optional(v.array(v.array(v.string()))),
  modulus: v.optional(v.string()),
  n: v.optional(v.string()),
  operation: mathOperationValidator,
  order: v.optional(v.number()),
  parameters: v.optional(mathProbabilityParametersValidator),
  point: v.optional(v.string()),
  pointSemantics: v.optional(v.literal("circle-radius-point")),
  points: v.optional(v.array(mathPointValidator)),
  right: v.optional(v.string()),
  right_matrix: v.optional(v.array(v.array(v.string()))),
  upper: v.optional(v.string()),
  upperInclusive: v.optional(v.boolean()),
  values: v.optional(v.array(v.string())),
  variable: v.optional(v.string()),
  variables: v.optional(v.array(v.string())),
  vector: v.optional(v.array(v.string())),
});

/** One labeled deterministic math item emitted by CAS. */
export const mathItemValidator = v.object({
  label: v.string(),
  latex: v.optional(v.string()),
  value: v.string(),
});

/** One deterministic CAS step kept with computation evidence. */
export const mathStepValidator = v.object({
  action: v.string(),
  items: v.array(mathItemValidator),
  primary: mathExpressionValidator,
  relation: v.optional(mathExpressionValidator),
  secondary: v.optional(mathExpressionValidator),
});

/** Canonical computation evidence without model-authored prose. */
export const mathComputationValidator = v.object({
  conditions: v.array(mathExpressionValidator),
  input: mathRequestValidator,
  items: v.array(mathItemValidator),
  kind: mathOperationValidator,
  operation: mathOperationValidator,
  primary: mathExpressionValidator,
  secondary: v.optional(mathExpressionValidator),
  stepStatus: mathStepStatusValidator,
  steps: v.array(mathStepValidator),
  status: mathStatusValidator,
});

/** Semantic prompt input captured without raw transcript storage. */
export const mathWorkInputValidator = v.object({
  givens: v.array(v.string()),
  kind: v.literal("prompt"),
  locale: v.string(),
  objective: v.string(),
  requirements: v.optional(v.array(v.string())),
  text: v.string(),
});

/** Trust evidence for a MathWork answer. */
export const mathWorkVerificationValidator = v.object({
  engine: v.string(),
  lane: verificationLaneValidator,
  reasonKey: mathCopyKeyValidator,
  source: v.string(),
  values: v.array(mathCopyValueValidator),
});

/** Semantic note persisted as copy key plus data, never display prose. */
export const mathWorkNoteValidator = v.object({
  copyKey: mathCopyKeyValidator,
  lane: verificationLaneValidator,
  source: v.optional(v.string()),
  values: v.array(mathCopyValueValidator),
});

/** Projection copy validator for one derivation level. */
const stepProjectionCopyValidator = v.object({
  key: mathCopyKeyValidator,
  values: v.array(mathCopyValueValidator),
});

/** Projection keys for one derivation step at every supported level. */
export const mathStepProjectionValidator = v.object({
  advanced: stepProjectionCopyValidator,
  atomic: stepProjectionCopyValidator,
  professor: stepProjectionCopyValidator,
  school: stepProjectionCopyValidator,
});

/** One ordered derivation step row in the normalized MathWork read model. */
export const mathWorkStepValidator = v.object({
  input: mathExpressionValidator,
  order: v.number(),
  output: mathExpressionValidator,
  projection: mathStepProjectionValidator,
  projectionLevels: v.array(stepProjectionLevelValidator),
  ruleId: v.string(),
  verificationLane: verificationLaneValidator,
  workId: v.string(),
});

/** Visual intent values owned by MathWork and interpreted by renderers. */
export const visualIntentValidator = v.object({
  descriptionKey: mathCopyKeyValidator,
  expressions: v.array(mathExpressionValidator),
  kind: literals(...visualIntentKindValues),
  source: v.string(),
  verificationLane: verificationLaneValidator,
});

/** Compact artifact manifest for localized math UI projection. */
export const mathWorkArtifactManifestValidator = v.union(
  v.object({
    expressionRefs: v.array(v.string()),
    kind: v.literal("formula-card"),
  }),
  v.object({
    kind: v.literal("step-list"),
    projectionLevel: stepProjectionLevelValidator,
    stepOrders: v.array(v.number()),
  }),
  v.object({
    kind: v.literal("assumptions"),
    limitationRefs: v.array(v.string()),
  }),
  v.object({
    kind: v.literal("visual-intent"),
    visualIntent: visualIntentValidator,
  })
);

/** Compact render artifact row aligned with MathWorkArtifact. */
export const mathWorkArtifactValidator = v.object({
  artifactId: v.string(),
  kind: mathWorkArtifactKindValidator,
  manifest: mathWorkArtifactManifestValidator,
  titleKey: mathCopyKeyValidator,
  verificationLane: verificationLaneValidator,
  workId: v.string(),
});

/** Canonical MathWork row shape without child computations, steps, or artifacts. */
export const mathWorkValidator = v.object({
  assumptions: v.array(mathWorkNoteValidator),
  createdAt: v.number(),
  input: mathWorkInputValidator,
  limitations: v.array(mathWorkNoteValidator),
  plannedRequest: mathRequestValidator,
  primaryResult: mathExpressionValidator,
  status: mathWorkStatusValidator,
  verification: mathWorkVerificationValidator,
  workId: v.string(),
});

/** Full encoded MathWork result used only for streaming compact data parts. */
export const mathWorkResultValidator = v.object({
  artifacts: v.array(mathWorkArtifactValidator),
  steps: v.array(mathWorkStepValidator),
  work: v.object({
    ...mathWorkValidator.fields,
    computations: v.array(mathComputationValidator),
  }),
});

/** Minimal math request context streamed while work is loading or failed. */
const mathDataInputValidator = v.object({
  givens: v.array(v.string()),
  objective: v.string(),
  request: v.string(),
  requirements: v.optional(v.array(v.string())),
});

/** Compact MathWork data part persisted in chat transcript rows. */
export const mathDataValidator = v.union(
  v.object({
    input: mathDataInputValidator,
    status: v.literal("loading"),
  }),
  v.object({
    result: mathWorkResultValidator,
    status: v.literal("done"),
  }),
  v.object({
    errorKey: mathCopyKeyValidator,
    input: mathDataInputValidator,
    status: v.literal("error"),
  })
);
