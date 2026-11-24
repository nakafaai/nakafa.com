import { Match, Schema } from "effect";

export const SUBSTANCES = [
  "oxygen",
  "glucose",
  "aminoAcids",
  "antibodies",
  "carbonDioxide",
  "urea",
  "alcohol",
  "bloodCells",
] as const;

const SubstanceSchema = Schema.Literals(SUBSTANCES);
export type Substance = typeof SubstanceSchema.Type;

const TransferModeSchema = Schema.Literals(["toFoetus", "toMother", "blocked"]);
type TransferMode = typeof TransferModeSchema.Type;

/**
 * Direction of exchange across the placental barrier: nutrients, oxygen,
 * antibodies, and alcohol cross from mother to foetus; carbon dioxide and
 * urea cross from foetus to mother; blood cells are blocked so maternal and
 * foetal blood never mix.
 */
export function transferMode(substance: Substance): TransferMode {
  return Match.value(substance).pipe(
    Match.when("oxygen", () => "toFoetus" as const),
    Match.when("glucose", () => "toFoetus" as const),
    Match.when("aminoAcids", () => "toFoetus" as const),
    Match.when("antibodies", () => "toFoetus" as const),
    Match.when("alcohol", () => "toFoetus" as const),
    Match.when("carbonDioxide", () => "toMother" as const),
    Match.when("urea", () => "toMother" as const),
    Match.when("bloodCells", () => "blocked" as const),
    Match.exhaustive
  );
}

/**
 * Horizontal particle position across the magnified chorionic villus wall
 * (maternal pool on left at -0.38, barrier at 0, foetal capillary on right at
 * +0.38) for normalized animation `phase` in [0, 1].
 */
export function particleX(mode: TransferMode, phase: number): number {
  const t = ((phase % 1) + 1) % 1;
  return Match.value(mode).pipe(
    Match.when("toFoetus", () => -0.38 + t * 0.76),
    Match.when("toMother", () => 0.38 - t * 0.76),
    Match.when("blocked", () => -0.38 + Math.sin(t * Math.PI) * 0.24),
    Match.exhaustive
  );
}
