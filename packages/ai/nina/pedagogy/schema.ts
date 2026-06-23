import { literalValues } from "@repo/utilities/literals";
import { Schema } from "effect";

export const PEDAGOGY_MOVE_KIND_VALUES = literalValues(
  "scaffold",
  "hint",
  "worked-example-bridge",
  "misconception-check",
  "verification-note"
);

/** Schema-owned teaching moves Nina can attach to an evidence workspace. */
export const PedagogyMoveKindSchema = Schema.Literal(
  ...PEDAGOGY_MOVE_KIND_VALUES
);

export type PedagogyMoveKind = Schema.Schema.Type<
  typeof PedagogyMoveKindSchema
>;

/** Maximum model-visible text stored in one pedagogy move summary. */
export const PEDAGOGY_MOVE_SUMMARY_MAX_LENGTH = 600;

/** Maximum evidence references one pedagogy move may cite. */
export const PEDAGOGY_MOVE_EVIDENCE_REF_LIMIT = 8;

/** Maximum length accepted for one pedagogy evidence reference. */
export const PEDAGOGY_MOVE_EVIDENCE_REF_MAX_LENGTH = 180;

const PedagogyEvidenceRefSchema = Schema.NonEmptyString.pipe(
  Schema.pattern(/\S/),
  Schema.maxLength(PEDAGOGY_MOVE_EVIDENCE_REF_MAX_LENGTH)
);

/**
 * One bounded pedagogy move grounded in deterministic evidence.
 *
 * The summary is model-visible. Evidence references point back to capability
 * evidence or artifact identifiers without storing raw specialist transcripts.
 */
export class PedagogyMove extends Schema.Class<PedagogyMove>("PedagogyMove")({
  evidenceRefs: Schema.Array(PedagogyEvidenceRefSchema).pipe(
    Schema.minItems(1),
    Schema.maxItems(PEDAGOGY_MOVE_EVIDENCE_REF_LIMIT),
    Schema.mutable
  ),
  kind: PedagogyMoveKindSchema,
  summary: Schema.NonEmptyString.pipe(
    Schema.maxLength(PEDAGOGY_MOVE_SUMMARY_MAX_LENGTH)
  ),
}) {}
