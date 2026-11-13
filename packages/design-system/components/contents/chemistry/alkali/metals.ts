import { Schema } from "effect";

/** The metals a water trough lab can drop in. */
export const MetalIdSchema = Schema.Literals([
  "lithium",
  "sodium",
  "potassium",
  "magnesium",
  "calcium",
]);
export type MetalId = typeof MetalIdSchema.Type;

const MetalSchema = Schema.Struct({
  /** How briskly it fizzes in cold water, 0 to 1, in the order classroom demonstrations show. */
  activity: Schema.Finite,
  /** Density in grams per cubic centimetre; below 1 the piece floats. */
  density: Schema.Finite,
  /** The balanced equation with water, in TeX. */
  equation: Schema.String,
  /** Whether the hydrogen catches fire with the metal's flame color. */
  flame: Schema.Boolean,
  /** First ionization energy in kilojoules per mole. */
  ionization: Schema.Finite,
  /** Whether the heat of the reaction melts the piece into a ball (melting point under 100 degrees). */
  melts: Schema.Boolean,
  /** Whether the hydroxide is too little soluble to stay dissolved, so the water turns milky. */
  milky: Schema.Boolean,
  /** Metallic radius in picometres. */
  radius: Schema.Finite,
  symbol: Schema.Literals(["Li", "Na", "K", "Mg", "Ca"]),
});
type Metal = typeof MetalSchema.Type;

/**
 * Densities, metallic radii and first ionization energies from the CRC
 * Handbook of Chemistry and Physics; melting points of sodium (98 degrees)
 * and potassium (64 degrees) are below boiling water, lithium's (181) is not.
 * Calcium hydroxide dissolves only about 1.7 g per litre, so it clouds the
 * water. Magnesium barely reacts with cold water.
 */
const METALS = {
  calcium: {
    activity: 0.45,
    density: 1.55,
    equation: "\\mathrm{Ca + 2H_2O \\rightarrow Ca(OH)_2 + H_2}",
    flame: false,
    ionization: 589.8,
    melts: false,
    milky: true,
    radius: 197,
    symbol: "Ca",
  },
  lithium: {
    activity: 0.3,
    density: 0.534,
    equation: "\\mathrm{2Li + 2H_2O \\rightarrow 2LiOH + H_2}",
    flame: false,
    ionization: 520.2,
    melts: false,
    milky: false,
    radius: 152,
    symbol: "Li",
  },
  magnesium: {
    activity: 0.04,
    density: 1.738,
    equation: "\\mathrm{Mg + 2H_2O \\rightarrow Mg(OH)_2 + H_2}",
    flame: false,
    ionization: 737.7,
    melts: false,
    milky: false,
    radius: 160,
    symbol: "Mg",
  },
  potassium: {
    activity: 1,
    density: 0.862,
    equation: "\\mathrm{2K + 2H_2O \\rightarrow 2KOH + H_2}",
    flame: true,
    ionization: 418.8,
    melts: true,
    milky: false,
    radius: 227,
    symbol: "K",
  },
  sodium: {
    activity: 0.7,
    density: 0.968,
    equation: "\\mathrm{2Na + 2H_2O \\rightarrow 2NaOH + H_2}",
    flame: false,
    ionization: 495.8,
    melts: true,
    milky: false,
    radius: 186,
    symbol: "Na",
  },
} as const satisfies Record<MetalId, Metal>;

/** The data of one metal. */
export function getMetal(id: MetalId): Metal {
  return METALS[id];
}

/** Whether a piece of the metal floats on water, lighter than water's 1 g/cm3. */
export function floats(id: MetalId) {
  return METALS[id].density < 1;
}

/**
 * How much of the piece has reacted after `seconds` of a run lasting
 * `duration`: a brisk metal is used up within the run, a slow one barely
 * starts, as the share 1 - exp(-k t) with k set by its activity.
 */
export function reacted(id: MetalId, seconds: number, duration: number) {
  const rate = (4 * METALS[id].activity) / duration;
  return 1 - Math.exp(-rate * Math.max(0, seconds));
}

/**
 * Where the piece of metal is and how big it is at `seconds` into a run: a
 * floating piece skims round the trough faster the more briskly it reacts, a
 * sinking one rests on the bottom, and each shrinks as it is used up.
 */
export function pieceAt(
  id: MetalId,
  seconds: number,
  duration: number,
  surface: number
) {
  const { activity } = METALS[id];
  const used = reacted(id, seconds, duration);
  const size = 0.45 * Math.cbrt(Math.max(0.02, 1 - used));
  const orbit = floats(id) ? activity * 3.2 : 0;
  const turn = seconds * (0.4 + activity * 1.6);
  return {
    size,
    used,
    x: orbit * Math.cos(turn),
    y: floats(id) ? surface + size * 0.3 : size,
    z: orbit * 0.6 * Math.sin(turn),
  };
}
