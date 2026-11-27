import { Match, Schema } from "effect";

const MOLECULES = ["triglyceride", "phospholipid"] as const;
const CHAINS = ["saturated", "unsaturated"] as const;
export const SCALES = ["molecule", "water"] as const;

const MoleculeSchema = Schema.Literals(MOLECULES);
const ChainSchema = Schema.Literals(CHAINS);
const ScaleSchema = Schema.Literals(SCALES);

export type Molecule = typeof MoleculeSchema.Type;
export type Chain = typeof ChainSchema.Type;
export type Scale = typeof ScaleSchema.Type;

/** Physical state at room temperature: straight saturated chains pack solid, kinked unsaturated chains stay liquid. */
export function roomState(chain: Chain): "solid" | "liquid" {
  return Match.value(chain).pipe(
    Match.when("saturated", () => "solid" as const),
    Match.when("unsaturated", () => "liquid" as const),
    Match.exhaustive
  );
}

/** Macroscopic arrangement in water: hydrophobic triglycerides coalesce into a droplet, amphipathic phospholipids self-assemble into a bilayer. */
export function waterForm(molecule: Molecule): "droplet" | "bilayer" {
  return Match.value(molecule).pipe(
    Match.when("triglyceride", () => "droplet" as const),
    Match.when("phospholipid", () => "bilayer" as const),
    Match.exhaustive
  );
}
