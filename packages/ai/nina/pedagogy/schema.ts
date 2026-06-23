import { Schema } from "effect";

function literalValues<const Values extends readonly [string, ...string[]]>(
  ...values: Values
) {
  return values;
}

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

/**
 * One bounded pedagogy move grounded in deterministic evidence.
 *
 * The summary is model-visible. Evidence references point back to capability
 * evidence or artifact identifiers without storing raw specialist transcripts.
 */
export class PedagogyMove extends Schema.Class<PedagogyMove>("PedagogyMove")({
  evidenceRefs: Schema.Array(Schema.NonEmptyString).pipe(Schema.mutable),
  kind: PedagogyMoveKindSchema,
  summary: Schema.NonEmptyString,
}) {}
