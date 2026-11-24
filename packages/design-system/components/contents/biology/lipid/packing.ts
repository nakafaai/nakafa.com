import { Array as Arr, Match, Schema } from "effect";

const MOLECULES = ["triglyceride", "phospholipid"] as const;
const CHAINS = ["saturated", "unsaturated"] as const;
export const SCALES = ["molecule", "water"] as const;

const MoleculeSchema = Schema.Literals(MOLECULES);
const ChainSchema = Schema.Literals(CHAINS);
const ScaleSchema = Schema.Literals(SCALES);

export type Molecule = typeof MoleculeSchema.Type;
export type Chain = typeof ChainSchema.Type;
export type Scale = typeof ScaleSchema.Type;

const TailSegmentSchema = Schema.Struct({
  id: Schema.String,
  kinked: Schema.Boolean,
  points: Schema.Array(
    Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite])
  ),
});

type TailSegment = typeof TailSegmentSchema.Type;

const BilayerHeadSchema = Schema.Struct({
  id: Schema.String,
  leaflet: Schema.Literals([-1, 1]),
  x: Schema.Finite,
  y: Schema.Finite,
  z: Schema.Finite,
});

type BilayerHead = typeof BilayerHeadSchema.Type;

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

/** Generate carbon-chain vertex points for one fatty acid tail starting at `(x, y, z)`. */
export function tailPoints(
  x: number,
  y: number,
  z: number,
  kinked: boolean,
  direction: 1 | -1 = -1
): readonly (readonly [number, number, number])[] {
  return Arr.makeBy(8, (index) => {
    const zig = index % 2 === 0 ? -0.02 : 0.02;
    const kinkOffset = kinked && index >= 4 ? (index - 3) * 0.055 : 0;
    const dy = direction * index * 0.072;
    return [x + zig + kinkOffset, y + dy, z] as const;
  });
}

/** Tail geometries for a single triglyceride (3 tails) or phospholipid (2 tails). */
export function moleculeTails(
  molecule: Molecule,
  chain: Chain
): readonly TailSegment[] {
  const xs =
    molecule === "triglyceride"
      ? ([-0.22, 0, 0.22] as const)
      : ([-0.14, 0.14] as const);
  return Arr.map(xs, (x, index) => {
    const kinked = chain === "unsaturated" && index === xs.length - 1;
    return {
      id: `${molecule}-${chain}-${x}`,
      kinked,
      points: tailPoints(x, 0.72, 0, kinked, -1),
    };
  });
}

/** Head positions for the water-scale phospholipid bilayer (two opposing leaflets). */
export function bilayerHeads(chain: Chain): readonly BilayerHead[] {
  const spacing = chain === "saturated" ? 0.17 : 0.23;
  const count = chain === "saturated" ? 9 : 7;
  const start = -((count - 1) * spacing) / 2;
  return Arr.flatMap([-1, 1] as const, (leaflet) =>
    Arr.makeBy(count, (index) => ({
      id: `leaflet-${leaflet}-${index}`,
      leaflet,
      x: start + index * spacing,
      y: leaflet === 1 ? 0.88 : 0.24,
      z: (index % 2 === 0 ? 1 : -1) * 0.06,
    }))
  );
}
