import { Match, Schema } from "effect";

const IsomerCompoundSchema = Schema.Literals([
  "butane",
  "methylpropane",
  "but1ene",
  "but2ene",
]);

export type IsomerCompound = typeof IsomerCompoundSchema.Type;

const CarbonNodeSchema = Schema.Struct({
  id: Schema.String,
  x: Schema.Finite,
  y: Schema.Finite,
});

const IsomerGeometrySchema = Schema.Struct({
  carbons: Schema.Array(CarbonNodeSchema),
  doubleBondIndex: Schema.Int,
  unsaturated: Schema.Boolean,
});

/** Return 3D carbon backbone positions and C=C unsaturation status for C4 isomers. */
export function evaluateIsomerGeometry(
  compound: IsomerCompound
): typeof IsomerGeometrySchema.Type {
  return Match.value(compound).pipe(
    Match.when("butane", () => ({
      carbons: [
        { id: "c1", x: -0.66, y: 0.54 },
        { id: "c2", x: -0.22, y: 0.72 },
        { id: "c3", x: 0.22, y: 0.54 },
        { id: "c4", x: 0.66, y: 0.72 },
      ],
      doubleBondIndex: -1,
      unsaturated: false,
    })),
    Match.when("methylpropane", () => ({
      carbons: [
        { id: "c1", x: -0.45, y: 0.48 },
        { id: "c2", x: 0, y: 0.64 },
        { id: "c3", x: 0.45, y: 0.48 },
        { id: "c4", x: 0, y: 1.02 },
      ],
      doubleBondIndex: -1,
      unsaturated: false,
    })),
    Match.when("but1ene", () => ({
      carbons: [
        { id: "c1", x: -0.66, y: 0.62 },
        { id: "c2", x: -0.22, y: 0.62 },
        { id: "c3", x: 0.22, y: 0.78 },
        { id: "c4", x: 0.66, y: 0.56 },
      ],
      doubleBondIndex: 0,
      unsaturated: true,
    })),
    Match.when("but2ene", () => ({
      carbons: [
        { id: "c1", x: -0.66, y: 0.52 },
        { id: "c2", x: -0.22, y: 0.68 },
        { id: "c3", x: 0.22, y: 0.68 },
        { id: "c4", x: 0.66, y: 0.84 },
      ],
      doubleBondIndex: 1,
      unsaturated: true,
    })),
    Match.exhaustive
  );
}
