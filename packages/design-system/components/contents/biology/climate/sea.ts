import { Array as Arr, Schema } from "effect";

/**
 * Global mean sea level rise since 1901, in metres, from the rates the IPCC
 * Sixth Assessment Report gives (AR6 WGI, Summary for Policymakers, A.1.7):
 * 1.3 mm a year from 1901 to 1971, 1.9 mm from 1971 to 2006, and 3.7 mm
 * from 2006 to 2018, about 0.20 m in all.
 */
const RECORD = [
  { from: 1901, rate: 0.0013, to: 1971 },
  { from: 1971, rate: 0.0019, to: 2006 },
  { from: 2006, rate: 0.0037, to: 2018 },
] as const;

/** The first and last year of the observed record. */
export const RECORD_YEARS = { first: 1901, last: 2018 } as const;

/** How far the global sea had risen since 1901 by `year`, in metres. */
export function recordRise(year: number) {
  return Arr.reduce(RECORD, 0, (rise, span) => {
    const years = Math.min(span.to, Math.max(span.from, year)) - span.from;
    return rise + years * span.rate;
  });
}

/** The emission pathways of AR6, from very low to very high. */
export const ScenarioSchema = Schema.Literals([
  "ssp119",
  "ssp126",
  "ssp245",
  "ssp370",
  "ssp585",
]);
export type Scenario = typeof ScenarioSchema.Type;

/**
 * What each pathway brings by 2100, from AR6 WGI: global warming in
 * 2081-2100 over 1850-1900 (SPM Table SPM.1, best estimates) and global mean
 * sea level rise by 2100 over 1995-2014 (SPM B.5.3 and Table 9.9, the median
 * with its likely range), in degrees Celsius and metres.
 */
export const SCENARIOS = {
  ssp119: { high: 0.55, low: 0.28, rise: 0.38, warming: 1.4 },
  ssp126: { high: 0.62, low: 0.32, rise: 0.44, warming: 1.8 },
  ssp245: { high: 0.76, low: 0.44, rise: 0.56, warming: 2.7 },
  ssp370: { high: 0.9, low: 0.55, rise: 0.68, warming: 3.6 },
  ssp585: { high: 1.01, low: 0.63, rise: 0.77, warming: 4.4 },
} as const;

/** The 2100 outlook of `scenario`. */
export function outlookOf(scenario: Scenario) {
  return SCENARIOS[scenario];
}

/**
 * The village in the card: a beach that climbs 1 m every 20 m inland, and
 * houses whose floors stand these heights in metres above today's high tide,
 * behind a sea wall whose crest stands 2.5 m above it when one is built.
 */
export const VILLAGE = {
  floors: [0.4, 0.6, 0.8, 1, 1.3, 1.6, 2, 2.5],
  slope: 1 / 20,
  wall: 2.5,
} as const;

/** The rate of rise in `year`'s period of the record, in metres a year. */
export function recordRate(year: number) {
  const clamped = Math.min(
    RECORD_YEARS.last,
    Math.max(RECORD_YEARS.first, year)
  );
  return Arr.reduce(RECORD, 0, (rate, span) =>
    clamped >= span.from && clamped <= span.to ? span.rate : rate
  );
}

/** How far inland the shoreline moves when the sea rises `rise` metres on a slope. */
export function retreatOf(rise: number, slope: number) {
  return rise / slope;
}

/**
 * Storm waves lose height crossing a mangrove forest: field studies collected
 * by McIvor et al. (2012, Natural Coastal Protection Series) measured 13 to
 * 66 percent less wave height across 100 m of mangroves. The card takes the
 * middle, half the height per 100 m, as an exponential decay.
 */
export function waveAtShore(height: number, mangroveWidth: number) {
  return height * 0.5 ** (Math.max(0, mangroveWidth) / 100);
}

/**
 * The highest water at the village: the sea's rise, a storm surge, and the
 * run-up of the waves that reach the shore.
 */
export function floodLevel(rise: number, surge: number, wave: number) {
  return rise + surge + wave;
}

/**
 * How many floors the water reaches. A sea wall keeps out any water lower
 * than its crest; water over it floods behind it as if it were not there.
 */
export function floodedCount(
  level: number,
  floors: readonly number[],
  wall: number
) {
  if (level < wall) {
    return 0;
  }
  return Arr.length(Arr.filter(floors, (floor) => floor < level));
}

/** The height of the ground `x` metres inland of today's high-tide line. */
export function groundAt(x: number) {
  return x * VILLAGE.slope;
}

/**
 * Where house `index` stands, in metres: inland until the ground reaches its
 * floor's height, in two staggered rows along the coast.
 */
export function houseSpot(index: number, floor: number) {
  const x = floor / VILLAGE.slope;
  return [x, groundAt(x), index % 2 === 0 ? -9 : 7] as const;
}
