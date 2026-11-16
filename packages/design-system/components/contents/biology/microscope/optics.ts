import { Schema } from "effect";

/**
 * What lies on the slide: cheek cells stained with methylene blue, onion
 * epidermis stained with iodine, a squash of an onion root tip with cells in
 * every stage of mitosis, or a stage micrometer, a slide engraved with a
 * 1 mm scale of 100 divisions.
 */
const SpecimenSchema = Schema.Literals([
  "cheek",
  "onion",
  "root",
  "micrometer",
]);
export type Specimen = typeof SpecimenSchema.Type;

/**
 * The field of view the learner measured at one total magnification: its
 * diameter in millimetres.
 */
const FieldSchema = Schema.Struct({
  diameter: Schema.Finite,
  magnification: Schema.Finite,
});
export type Field = typeof FieldSchema.Type;

/**
 * A calibration of the eyepiece graticule against the stage micrometer at
 * the first objective: `eyepiece` graticule divisions line up exactly with
 * `micrometer` micrometer divisions.
 */
const GraticuleSchema = Schema.Struct({
  eyepiece: Schema.Finite,
  micrometer: Schema.Finite,
});
export type Graticule = typeof GraticuleSchema.Type;

/**
 * The field number of a school microscope's eyepiece, in millimetres: the
 * field of view on the slide is this divided by the objective's
 * magnification.
 */
export const FIELD_NUMBER = 18;

/** How much of the field's diameter the graticule's scale spans in the eyepiece. */
export const GRATICULE_SPAN = 0.8;

/** One division of the stage micrometer, 1 mm split into 100, in micrometres. */
export const MICROMETER_DIVISION = 10;

/** How many divisions the eyepiece graticule's scale carries. */
export const GRATICULE_DIVISIONS = 100;

/** The total magnification: the eyepiece's times the objective's. */
export function totalMagnification(eyepiece: number, objective: number) {
  return eyepiece * objective;
}

/**
 * The diameter of the field of view at `magnification`, in millimetres. The
 * field shrinks as the magnification grows, in inverse proportion, so
 * d₂ = d₁ × M₁ / M₂.
 */
export function fieldDiameter(field: Field, magnification: number) {
  return (field.diameter * field.magnification) / magnification;
}

/** How many cells `cell` micrometres long fit across a field `diameter` millimetres wide. */
export function cellsAcross(diameter: number, cell: number) {
  return (diameter * 1000) / cell;
}

/**
 * What one graticule division spans on the slide, in micrometres, with
 * `objective`: the calibration gives its value at `calibrated`, and the
 * graticule sits in the eyepiece, so its value on the slide falls in
 * proportion as the objective magnifies more.
 */
export function divisionValue(
  graticule: Graticule,
  calibrated: number,
  objective: number
) {
  return (
    ((graticule.micrometer * MICROMETER_DIVISION) / graticule.eyepiece) *
    (calibrated / objective)
  );
}

/** How many graticule divisions a length of `micrometres` spans when one division is `value` micrometres. */
export function divisionsSpanned(micrometres: number, value: number) {
  return micrometres / value;
}

/**
 * The diameter of the field of view with `objective`, in millimetres: from
 * the field a learner measured when there is one; else from the calibrated
 * graticule, whose scale spans a fixed share of the field; else from the
 * eyepiece's field number.
 */
export function fieldAt({
  eyepiece,
  field,
  graticule,
  objective,
  objectives,
}: {
  readonly eyepiece: number;
  readonly field: Field | undefined;
  readonly graticule: Graticule | undefined;
  readonly objective: number;
  readonly objectives: readonly [number, ...number[]];
}) {
  if (field !== undefined) {
    return fieldDiameter(field, totalMagnification(eyepiece, objective));
  }
  if (graticule !== undefined) {
    const value = divisionValue(graticule, objectives[0], objective);
    return (GRATICULE_DIVISIONS * value) / GRATICULE_SPAN / 1000;
  }
  return FIELD_NUMBER / objective;
}
