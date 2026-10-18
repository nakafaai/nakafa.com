import { Id } from "@repo/backend/confect/_generated/id";
import { isSingleLine } from "@repo/utilities/line";
import { Array as Arr, Order, Schema } from "effect";

/** Every grade is written on this scale, 0 to 100 (blueprint, Skema nilai). */
export const GradeValue = Schema.Finite.check(
  Schema.isBetween({ maximum: 100, minimum: 0 })
);

/** A band's label: one line, 1 to 40 characters. */
const BandLabel = Schema.String.check(
  Schema.isTrimmed(),
  isSingleLine,
  Schema.isMinLength(1),
  Schema.isMaxLength(40)
);

/**
 * One band of a scheme: a label for the values from its minimum up to the next
 * band's minimum, such as a letter or a phrase that the report prints.
 */
export const Band = Schema.Struct({ label: BandLabel, minimum: GradeValue });

/**
 * A grading scheme: its bands, which may be none, and its KKTP, the minimum
 * value that reaches the achievement criterion (kriteria ketercapaian tujuan
 * pembelajaran). Kurikulum Merdeka uses numbers from 0 to 100 with a KKTP and
 * no bands (blueprint, Skema nilai).
 */
export const GradingScheme = Schema.Struct({
  bands: Schema.Array(Band),
  kktp: GradeValue,
});
export type GradingScheme = typeof GradingScheme.Type;

/**
 * The built-in scheme that judges a grade when a school stores no version of
 * its own: KKTP on the 0 to 100 scale, with no bands. The blueprint sets the
 * scale and not the KKTP value, so 75 is a placeholder until the owner sets the
 * default (ADR 0033, What Stays Open).
 */
export const DEFAULT_GRADING_SCHEME: GradingScheme = { bands: [], kktp: 75 };

/**
 * One stored version of a school's scheme. A version takes effect at
 * `effectiveFrom` and never changes after a grade names it, so a changed scheme
 * is a new version (ADR 0033).
 */
export const gradingSchemeValidator = Schema.Struct({
  bands: Schema.Array(Band),
  effectiveFrom: Schema.Finite,
  kktp: GradeValue,
  tenantId: Id("tenants"),
});

/** The bands in ascending order of their minimum, the order a school reads them in. */
export const normalizeScheme = (scheme: GradingScheme): GradingScheme => ({
  bands: Arr.sort(
    scheme.bands,
    Order.mapInput(Order.Number, (band: typeof Band.Type) => band.minimum)
  ),
  kktp: scheme.kktp,
});

/** The band a value reaches: the highest band whose minimum the value meets, if any. */
export const bandOf = (scheme: GradingScheme, value: number) =>
  Arr.findLast(normalizeScheme(scheme).bands, (band) => value >= band.minimum);

/** Whether a value reaches the scheme's KKTP. */
export const reachesKktp = (scheme: GradingScheme, value: number) =>
  value >= scheme.kktp;
