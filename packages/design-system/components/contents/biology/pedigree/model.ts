import { Match, Schema } from "effect";

const HumanPatternSchema = Schema.Literals([
  "aboBlood",
  "sexDetermination",
  "xLinked",
]);

export type HumanPattern = typeof HumanPatternSchema.Type;

const PedigreeNodeSchema = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  sex: Schema.Literals(["male", "female"]),
  status: Schema.Literals(["normal", "carrier", "affected"]),
  x: Schema.Finite,
  y: Schema.Finite,
});

/** Build a 3-generation family pedigree tree for ABO codominance, XX/XY, or X-linked recessive traits. */
export function evaluatePedigreeTree(
  pattern: HumanPattern
): readonly (typeof PedigreeNodeSchema.Type)[] {
  return Match.value(pattern).pipe(
    Match.when("aboBlood", () => [
      {
        id: "p1",
        label: "IA i",
        sex: "male" as const,
        status: "normal" as const,
        x: -0.42,
        y: 1.04,
      },
      {
        id: "p2",
        label: "IB i",
        sex: "female" as const,
        status: "normal" as const,
        x: 0.42,
        y: 1.04,
      },
      {
        id: "c1",
        label: "IA IB",
        sex: "female" as const,
        status: "carrier" as const,
        x: -0.66,
        y: 0.56,
      },
      {
        id: "c2",
        label: "IA i",
        sex: "male" as const,
        status: "normal" as const,
        x: -0.22,
        y: 0.56,
      },
      {
        id: "c3",
        label: "IB i",
        sex: "female" as const,
        status: "normal" as const,
        x: 0.22,
        y: 0.56,
      },
      {
        id: "c4",
        label: "i i",
        sex: "male" as const,
        status: "affected" as const,
        x: 0.66,
        y: 0.56,
      },
    ]),
    Match.when("sexDetermination", () => [
      {
        id: "p1",
        label: "XY",
        sex: "male" as const,
        status: "normal" as const,
        x: -0.42,
        y: 1.04,
      },
      {
        id: "p2",
        label: "XX",
        sex: "female" as const,
        status: "normal" as const,
        x: 0.42,
        y: 1.04,
      },
      {
        id: "c1",
        label: "XX",
        sex: "female" as const,
        status: "normal" as const,
        x: -0.54,
        y: 0.56,
      },
      {
        id: "c2",
        label: "XY",
        sex: "male" as const,
        status: "normal" as const,
        x: -0.18,
        y: 0.56,
      },
      {
        id: "c3",
        label: "XX",
        sex: "female" as const,
        status: "normal" as const,
        x: 0.18,
        y: 0.56,
      },
      {
        id: "c4",
        label: "XY",
        sex: "male" as const,
        status: "normal" as const,
        x: 0.54,
        y: 0.56,
      },
    ]),
    Match.when("xLinked", () => [
      {
        id: "p1",
        label: "XH Y",
        sex: "male" as const,
        status: "normal" as const,
        x: -0.42,
        y: 1.04,
      },
      {
        id: "p2",
        label: "XH Xh",
        sex: "female" as const,
        status: "carrier" as const,
        x: 0.42,
        y: 1.04,
      },
      {
        id: "c1",
        label: "XH XH",
        sex: "female" as const,
        status: "normal" as const,
        x: -0.66,
        y: 0.56,
      },
      {
        id: "c2",
        label: "XH Xh",
        sex: "female" as const,
        status: "carrier" as const,
        x: -0.22,
        y: 0.56,
      },
      {
        id: "c3",
        label: "XH Y",
        sex: "male" as const,
        status: "normal" as const,
        x: 0.22,
        y: 0.56,
      },
      {
        id: "c4",
        label: "Xh Y",
        sex: "male" as const,
        status: "affected" as const,
        x: 0.66,
        y: 0.56,
      },
    ]),
    Match.exhaustive
  );
}
