import { Array as Arr, Match, Schema } from "effect";

const AdditionMonomerSchema = Schema.Literals([
  "ethene",
  "propene",
  "chloroethene",
  "tetrafluoroethene",
]);

export type AdditionMonomer = typeof AdditionMonomerSchema.Type;

const RepeatUnitSchema = Schema.Struct({
  id: Schema.String,
  sideGroupKind: Schema.Literals([
    "hydrogen",
    "methyl",
    "chlorine",
    "fluorine",
  ]),
  x: Schema.Finite,
});

/** Build repeating carbon-backbone units for an addition polymer chain of length n. */
export function evaluateAdditionChain(
  monomer: AdditionMonomer,
  chainLength: number
): readonly (typeof RepeatUnitSchema.Type)[] {
  const n = Math.min(8, Math.max(2, Math.round(chainLength)));
  const sideGroupKind = Match.value(monomer).pipe(
    Match.when("ethene", () => "hydrogen" as const),
    Match.when("propene", () => "methyl" as const),
    Match.when("chloroethene", () => "chlorine" as const),
    Match.when("tetrafluoroethene", () => "fluorine" as const),
    Match.exhaustive
  );
  const span = 1.85;
  return Arr.makeBy(n, (index) => ({
    id: `u-${index}`,
    sideGroupKind,
    x: -span / 2 + (index / Math.max(1, n - 1)) * span,
  }));
}
