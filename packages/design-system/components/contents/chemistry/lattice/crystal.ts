import { Array as Arr, Schema } from "effect";

/** The rock-salt crystals a lattice lab can build, each a 1 : 1 salt of two ions. */
export const CrystalIdSchema = Schema.Literals([
  "sodium-chloride",
  "magnesium-oxide",
  "lithium-fluoride",
  "potassium-chloride",
  "sodium-fluoride",
  "sodium-bromide",
]);
export type CrystalId = typeof CrystalIdSchema.Type;

/** One ion of a crystal: its symbol and charge in TeX and its radius in picometres. */
const IonSchema = Schema.Struct({
  radius: Schema.Finite,
  symbol: Schema.Literals(["Li", "Na", "K", "Mg", "F", "Cl", "Br", "O"]),
  tex: Schema.String,
});

const CrystalSchema = Schema.Struct({
  anion: IonSchema,
  cation: IonSchema,
  formula: Schema.String,
  /** The edge of the cubic unit cell in picometres, measured by X-ray diffraction. */
  lattice: Schema.Finite,
});
type Crystal = typeof CrystalSchema.Type;

/**
 * Six-coordinate ionic radii from Shannon (Acta Cryst. A32, 1976) and room
 * temperature lattice constants from the CRC Handbook of Chemistry and
 * Physics. In the rock-salt structure the edge holds two touching ion pairs,
 * so a = 2 (r+ + r-) to within a few percent.
 */
const CRYSTALS = {
  "lithium-fluoride": {
    anion: { radius: 133, symbol: "F", tex: "\\mathrm{F^-}" },
    cation: { radius: 76, symbol: "Li", tex: "\\mathrm{Li^+}" },
    formula: "\\mathrm{LiF}",
    lattice: 402.7,
  },
  "magnesium-oxide": {
    anion: { radius: 140, symbol: "O", tex: "\\mathrm{O^{2-}}" },
    cation: { radius: 72, symbol: "Mg", tex: "\\mathrm{Mg^{2+}}" },
    formula: "\\mathrm{MgO}",
    lattice: 421.2,
  },
  "potassium-chloride": {
    anion: { radius: 181, symbol: "Cl", tex: "\\mathrm{Cl^-}" },
    cation: { radius: 138, symbol: "K", tex: "\\mathrm{K^+}" },
    formula: "\\mathrm{KCl}",
    lattice: 629.2,
  },
  "sodium-bromide": {
    anion: { radius: 196, symbol: "Br", tex: "\\mathrm{Br^-}" },
    cation: { radius: 102, symbol: "Na", tex: "\\mathrm{Na^+}" },
    formula: "\\mathrm{NaBr}",
    lattice: 597.3,
  },
  "sodium-chloride": {
    anion: { radius: 181, symbol: "Cl", tex: "\\mathrm{Cl^-}" },
    cation: { radius: 102, symbol: "Na", tex: "\\mathrm{Na^+}" },
    formula: "\\mathrm{NaCl}",
    lattice: 564,
  },
  "sodium-fluoride": {
    anion: { radius: 133, symbol: "F", tex: "\\mathrm{F^-}" },
    cation: { radius: 102, symbol: "Na", tex: "\\mathrm{Na^+}" },
    formula: "\\mathrm{NaF}",
    lattice: 463.2,
  },
} as const satisfies Record<CrystalId, Crystal>;

/** The ions, formula and lattice constant of one crystal. */
export function getCrystal(id: CrystalId): Crystal {
  return CRYSTALS[id];
}

/** One ion placed in a block of crystal, in units of the ion spacing a / 2. */
const SiteSchema = Schema.Struct({
  kind: Schema.Literals(["cation", "anion"]),
  position: Schema.Tuple([Schema.Int, Schema.Int, Schema.Int]),
});
type Site = typeof SiteSchema.Type;

/**
 * Every ion of a cube of rock-salt crystal `cells` unit cells wide, centred on
 * the origin: ions sit on every point of a simple cubic grid of 2 cells + 1
 * points per edge, alternating cation and anion, so each ion has six of the
 * other kind as its nearest neighbours.
 */
export function rockSalt(cells: number): readonly Site[] {
  const side = 2 * cells + 1;
  const half = cells;
  return Arr.flatMap(Arr.range(0, side - 1), (x) =>
    Arr.flatMap(Arr.range(0, side - 1), (y) =>
      Arr.map(Arr.range(0, side - 1), (z) => {
        const position = [x - half, y - half, z - half] as const;
        const sum = Math.abs(position[0] + position[1] + position[2]);
        return {
          kind: sum % 2 === 0 ? ("cation" as const) : ("anion" as const),
          position,
        };
      })
    )
  );
}

/** How many of each ion a block holds: cations and anions differ by one at most. */
export function countIons(sites: readonly Site[]) {
  const cations = Arr.filter(sites, (site) => site.kind === "cation").length;
  return { anions: sites.length - cations, cations };
}
