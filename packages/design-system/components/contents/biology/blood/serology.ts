import { Array as Arr, Match, Schema } from "effect";

/**
 * The ABO blood groups. A group names the antigens its red cells carry: A, B,
 * both (AB), or neither (O).
 *
 * @see OpenStax Anatomy and Physiology 2e, section 18.6 "Blood Typing",
 * https://openstax.org/books/anatomy-and-physiology-2e/pages/18-6-blood-typing
 */
const GroupSchema = Schema.Literals(["A", "B", "AB", "O"]);
export type Group = typeof GroupSchema.Type;

/** Whether a sample's red cells carry the Rhesus D antigen. */
const RhesusSchema = Schema.Literals(["positive", "negative"]);
type Rhesus = typeof RhesusSchema.Type;

/**
 * The three antisera of a slide or tile test, named by the antigen each one's
 * antibody binds: anti-A, anti-B and anti-D.
 */
const SerumSchema = Schema.Literals(["a", "b", "d"]);
export type Serum = typeof SerumSchema.Type;

/** One blood sample on the tile: its name, ABO group, and Rhesus factor. */
const SampleSchema = Schema.Struct({
  group: GroupSchema,
  name: Schema.String,
  rhesus: RhesusSchema,
});
export type Sample = typeof SampleSchema.Type;

/** The red cell antigens the tile tests for. */
type Antigen = "A" | "B" | "D";

/**
 * The sera in the order a row of the tile holds them, left to right, as the
 * combined ABD kit lays them out.
 *
 * @see J. Mitra & Co., "Combined ABD Monoclonal Antibodies" instructions for
 * use, slide method, https://jmitra.co.in/wp-content/uploads/2026/06/Manual-Combine-ABD-1.pdf
 */
export const SERA = ["a", "b", "d"] as const satisfies readonly Serum[];

/**
 * The antigens on the red cells of a group and Rhesus factor: A on group A
 * and AB cells, B on group B and AB cells, and D on every Rhesus positive
 * cell (OpenStax Anatomy and Physiology 2e, section 18.6).
 */
function antigens(group: Group, rhesus: Rhesus): readonly Antigen[] {
  const abo = Match.value(group).pipe(
    Match.when("A", () => ["A"] as const),
    Match.when("B", () => ["B"] as const),
    Match.when("AB", () => ["A", "B"] as const),
    Match.when("O", () => [] as const),
    Match.exhaustive
  );
  return rhesus === "positive" ? [...abo, "D"] : abo;
}

/** The antigen each serum's antibody binds. */
const TARGET = { a: "A", b: "B", d: "D" } as const satisfies Record<
  Serum,
  Antigen
>;

/**
 * Whether the red cells of `sample` clump in `serum`: an antibody binds the
 * antigen it is made against and links neighbouring cells into visible
 * clumps, so a drop agglutinates exactly when its cells carry that antigen.
 */
export function agglutinates(serum: Serum, sample: Sample) {
  return Arr.contains(antigens(sample.group, sample.rhesus), TARGET[serum]);
}

/**
 * The group and Rhesus factor that the three reactions of a row point to,
 * read as a technician reads them: clumps in anti-A mean antigen A, clumps
 * in anti-B antigen B, and clumps in anti-D a Rhesus positive sample.
 */
export function groupOf(reactions: Readonly<Record<Serum, boolean>>) {
  const rhesus = reactions.d ? "positive" : "negative";
  if (reactions.a) {
    return { group: reactions.b ? "AB" : "A", rhesus } as const;
  }
  return { group: reactions.b ? "B" : "O", rhesus } as const;
}

/** The sign written after a group for its Rhesus factor, as in A+ or O−, with a true minus sign. */
export function rhesusSign(rhesus: Rhesus) {
  return rhesus === "positive" ? "+" : "−";
}
