import { ModelIdSchema } from "@repo/ai/config/model";
import { VerificationLaneSchema } from "@repo/math/schema/lane";
import { MathWorkResult } from "@repo/math/schema/work";
import { Schema } from "effect";

export const pedagogyProjectionSchemaVersion = "pedagogy.projection.v1";
export const pedagogyPromptVersion = "math.pedagogy.v1";

export const pedagogyEvidenceKindValues = [
  "assumption",
  "limitation",
  "result",
  "step",
  "verification",
] as const;

const markdownBlockControlPattern = /^\s*(#{1,6}\s|[-+]\s|\d+[.)]\s|>\s|```)/mu;
const latexSpanPattern =
  /\$\$[\s\S]*?\$\$|\$[^$\n]+\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]/gu;
const sympyEquationPattern = /\bEq\s*\(/u;
const pythonPowerPattern = /[\p{L}\p{N})\]]\*\*[\p{L}\p{N}({]/u;
const rawPowerPattern = /[\p{L}\p{N})\]]\^\{?\d/u;
const rawMultiplicationPattern =
  /[\p{L}\p{N})\]]\*[\p{L}\p{N}(]|[\p{L}\p{N})\]]\s+\*\s+[\p{L}\p{N}(]/u;
const asciiInequalityPattern =
  /[\p{L}\p{N})\]]\s*(?:>=|<=|>|<)\s*-?[\p{L}\p{N}(]/u;
const rawEqualityPattern = /[\p{L}\p{N})\]]\s*=\s*-?[\p{L}\p{N}(]/u;
const vagueTrustPattern =
  /\b(perhitungan sistem|sudah dicek|telah dicek|checked by the system|system calculation|verified by the system)\b/iu;
const implementationLabelPattern = /\b(?:CAS|Python|SymPy|engine)\b/u;

const PedagogyMarkdownTextSchema = Schema.NonEmptyTrimmedString.pipe(
  Schema.filter(isSafePedagogyMarkdown, {
    message: () =>
      "Expected learner Markdown with LaTeX math and no raw CAS or implementation syntax.",
  })
).annotations({
  description:
    "Evidence-bound learner-facing Markdown. Mathematical expressions must use LaTeX delimiters; raw CAS, Python, SymPy, ASCII exponent, multiplication, and inequality syntax are rejected outside LaTeX.",
});

/** Evidence categories a learner-facing pedagogy sentence may cite. */
export const PedagogyEvidenceKindSchema = Schema.Literal(
  ...pedagogyEvidenceKindValues
);

/** One bounded deterministic evidence row available to PedagogyNarrator. */
export class PedagogyEvidenceItem extends Schema.Class<PedagogyEvidenceItem>(
  "PedagogyEvidenceItem"
)({
  expression: Schema.optional(Schema.String),
  kind: PedagogyEvidenceKindSchema,
  lane: VerificationLaneSchema,
  latex: Schema.optional(Schema.String),
  ref: Schema.NonEmptyString,
  summary: Schema.NonEmptyString,
}) {}

/** Bounded deterministic evidence packet passed to the live narrator Adapter. */
export class PedagogyEvidencePacket extends Schema.Class<PedagogyEvidencePacket>(
  "PedagogyEvidencePacket"
)({
  evidenceHash: Schema.NonEmptyString,
  items: Schema.Array(PedagogyEvidenceItem).pipe(Schema.mutable),
  locale: Schema.NonEmptyString,
  operation: Schema.NonEmptyString,
  resultExpression: Schema.String,
  resultLatex: Schema.String,
  workId: Schema.NonEmptyString,
}) {}

/** Schema-owned service input for live pedagogy narration. */
export class PedagogyNarrationInput extends Schema.Class<PedagogyNarrationInput>(
  "PedagogyNarrationInput"
)({
  locale: Schema.NonEmptyString,
  modelId: ModelIdSchema,
  result: MathWorkResult,
}) {}

const EvidenceRefSchema = Schema.NonEmptyString.annotations({
  description:
    "Stable reference to deterministic MathWork evidence that supports this sentence.",
});

const PedagogySentenceSchema = Schema.Struct({
  evidenceRefs: Schema.Array(EvidenceRefSchema).pipe(
    Schema.minItems(1),
    Schema.mutable
  ),
  id: Schema.NonEmptyString,
  text: PedagogyMarkdownTextSchema,
}).pipe(Schema.mutable);

export const PedagogyNarrationDraftSchema = Schema.Struct({
  sentences: Schema.Array(
    Schema.Struct({
      evidenceRefs: Schema.Array(EvidenceRefSchema).pipe(
        Schema.minItems(1),
        Schema.mutable
      ),
      text: PedagogyMarkdownTextSchema,
    }).pipe(Schema.mutable)
  )
    .pipe(Schema.minItems(1), Schema.maxItems(5), Schema.mutable)
    .annotations({
      description:
        "Evidence-bound student narration. Every text entry needs allowed evidenceRefs and must render math as Markdown/LaTeX.",
    }),
}).pipe(Schema.mutable);

const PedagogyModelMetadataSchema = Schema.Struct({
  gatewayModelId: Schema.NonEmptyString,
  modelId: Schema.NonEmptyString,
  promptVersion: Schema.Literal(pedagogyPromptVersion),
  provider: Schema.Literal("ai-gateway"),
  schemaVersion: Schema.Literal(pedagogyProjectionSchemaVersion),
}).pipe(Schema.mutable);

/** Non-canonical learner narration generated from deterministic MathWork. */
export class PedagogyProjection extends Schema.Class<PedagogyProjection>(
  "PedagogyProjection"
)({
  evidenceHash: Schema.NonEmptyString,
  kind: Schema.Literal("math-pedagogy-projection"),
  locale: Schema.NonEmptyString,
  model: PedagogyModelMetadataSchema,
  narratedAt: Schema.NonNegativeInt,
  sentences: Schema.Array(PedagogySentenceSchema).pipe(
    Schema.minItems(1),
    Schema.mutable
  ),
  workId: Schema.NonEmptyString,
}) {}

/** Encoded PedagogyProjection schema used for serializable transcript data. */
export const PedagogyProjectionDataSchema =
  Schema.encodedSchema(PedagogyProjection);

const PedagogyLoadingLaneSchema = Schema.Struct({
  status: Schema.Literal("loading"),
  workId: Schema.NonEmptyString,
}).pipe(Schema.mutable);

const PedagogyDoneLaneSchema = Schema.Struct({
  projection: PedagogyProjectionDataSchema,
  status: Schema.Literal("done"),
}).pipe(Schema.mutable);

const PedagogyErrorLaneSchema = Schema.Struct({
  reason: Schema.NonEmptyString,
  status: Schema.Literal("error"),
  workId: Schema.NonEmptyString,
}).pipe(Schema.mutable);

/** Non-canonical live narration lane nested inside the public math data part. */
export const PedagogyLaneSchema = Schema.Union(
  PedagogyLoadingLaneSchema,
  PedagogyDoneLaneSchema,
  PedagogyErrorLaneSchema
);

export type PedagogyEvidenceKind = Schema.Schema.Type<
  typeof PedagogyEvidenceKindSchema
>;
export type PedagogyEvidenceItemShape = Schema.Schema.Type<
  typeof PedagogyEvidenceItem
>;
export type PedagogyEvidencePacketShape = Schema.Schema.Type<
  typeof PedagogyEvidencePacket
>;
export type PedagogyNarrationInputShape = Schema.Schema.Type<
  typeof PedagogyNarrationInput
>;
export type PedagogyNarrationDraft = Schema.Schema.Type<
  typeof PedagogyNarrationDraftSchema
>;
export type PedagogyProjectionShape = Schema.Schema.Type<
  typeof PedagogyProjection
>;
export type PedagogyProjectionEncoded = Schema.Schema.Encoded<
  typeof PedagogyProjection
>;
export type PedagogyLane = Schema.Schema.Type<typeof PedagogyLaneSchema>;

/** Checks that live narration uses Markdown/LaTeX without raw engine syntax. */
export function isSafePedagogyMarkdown(text: string) {
  const trimmed = text.trim();

  if (trimmed.length === 0) {
    return false;
  }

  if (markdownBlockControlPattern.test(trimmed)) {
    return false;
  }

  if (vagueTrustPattern.test(trimmed)) {
    return false;
  }

  if (implementationLabelPattern.test(trimmed)) {
    return false;
  }

  return !containsRawMathSyntax(textOutsideLatex(trimmed));
}

/** Removes valid LaTeX spans before raw formula syntax checks run. */
function textOutsideLatex(text: string) {
  return text.replace(latexSpanPattern, " ");
}

/** Finds formula syntax that should have been rendered as LaTeX. */
function containsRawMathSyntax(text: string) {
  return [
    sympyEquationPattern,
    pythonPowerPattern,
    rawPowerPattern,
    rawMultiplicationPattern,
    asciiInequalityPattern,
    rawEqualityPattern,
  ].some((pattern) => pattern.test(text));
}
