import { Array as Arr, Schema } from "effect";

/**
 * Carbon dioxide in the air at Mauna Loa, the annual means of NOAA's Global
 * Monitoring Laboratory (co2_annmean_mlo.txt), in parts per million.
 */
const MAUNA_LOA = [
  [1960, 316.91],
  [1970, 325.68],
  [1980, 338.76],
  [1990, 354.45],
  [2000, 369.71],
  [2010, 390.1],
  [2020, 414.21],
  [2024, 424.61],
] as const;

/** The first and last year of the record the card reads. */
export const RECORD_SPAN = { first: 1960, last: 2024 } as const;

/** The CO2 level in `year`, read between the record's years along a straight line. */
export function recordLevel(year: number) {
  const clamped = Math.min(RECORD_SPAN.last, Math.max(RECORD_SPAN.first, year));
  return Arr.reduce(
    Arr.zip(MAUNA_LOA, Arr.drop(MAUNA_LOA, 1)),
    MAUNA_LOA[0][1],
    (level, [[from, low], [to, high]]) =>
      clamped >= from && clamped <= to
        ? low + ((high - low) * (clamped - from)) / (to - from)
        : level
  );
}

/**
 * The global carbon budget the card starts from, in the Global Carbon
 * Project's "Global Carbon Budget 2024" (Friedlingstein et al., Earth System
 * Science Data 17, 2025): fossil CO2 of 10.2 GtC in 2024, land-use change of
 * 1.1 GtC a year, and natural sinks that took 2.9 GtC (ocean) plus 3.2 GtC
 * (land) a year over 2014-2023. One ppm of CO2 holds 2.124 GtC.
 */
export const BUDGET = {
  fossil: 10.2,
  land: 1.1,
  perPpm: 2.124,
  preindustrial: 280,
  sinks: 6.1,
  start: 424.61,
  startYear: 2024,
  startWarming: 1.3,
} as const;

/**
 * The share of fossil CO2 each region emitted in 2023, from the same
 * budget: China 31%, the USA 13%, India 8%, the EU 7%, and the rest of the
 * world 41%, international flights and shipping included.
 */
export const REGIONS = {
  china: 0.31,
  europe: 0.07,
  india: 0.08,
  rest: 0.41,
  usa: 0.13,
} as const;

export const RegionSchema = Schema.Literals([
  "china",
  "usa",
  "india",
  "europe",
  "rest",
]);
export type Region = typeof RegionSchema.Type;

/** What a pathway does: how much fossil CO2 it cuts by 2050, and extra trees' uptake. */
export const PathwaySchema = Schema.Struct({
  cut: Schema.Finite,
  forest: Schema.Finite,
});
export type Pathway = typeof PathwaySchema.Type;

/** The cut that the regions which join an agreement bring: all of their fossil CO2 by 2050. */
export function cutOf(joined: readonly Region[]) {
  return Arr.reduce(Arr.dedupe(joined), 0, (cut, region) => cut + REGIONS[region]);
}

/**
 * The sinks take up CO2 in proportion to how far the air is above its
 * preindustrial 280 ppm, which matches 6.1 GtC a year at today's level.
 */
export function sinkAt(level: number) {
  return (BUDGET.sinks * (level - BUDGET.preindustrial)) / (BUDGET.start - BUDGET.preindustrial);
}

/** Fossil emissions in `year`, falling in a straight line by the pathway's cut until 2050. */
export function fossilIn(year: number, pathway: Pathway) {
  const progress = Math.min(1, Math.max(0, (year - BUDGET.startYear) / (2050 - BUDGET.startYear)));
  return BUDGET.fossil * (1 - Math.min(1, Math.max(0, pathway.cut)) * progress);
}

/** One year of the budget: the CO2 level, the net emissions, and the warming. */
export const YearSchema = Schema.Struct({
  level: Schema.Finite,
  net: Schema.Finite,
  warming: Schema.Finite,
  year: Schema.Finite,
});
export type Year = typeof YearSchema.Type;

/**
 * The budget year by year from 2024 to `last`. Each year the air gains what
 * is emitted minus what the sinks and new forests take up. Warming follows
 * the cumulative CO2 emitted since 2024 at AR6's best estimate of 0.45 °C
 * per 1000 GtCO2 (SPM D.1.1), from about 1.3 °C of human-caused warming in
 * 2024 (Forster et al., Earth System Science Data 17, 2025); 1 GtC is
 * 3.664 GtCO2.
 */
export function pathwayOf(pathway: Pathway, last: number) {
  const years = Math.max(1, Math.round(last - BUDGET.startYear));
  return Arr.scan(
    Arr.range(1, years),
    { level: BUDGET.start, net: BUDGET.fossil + BUDGET.land - BUDGET.sinks, total: 0, warming: BUDGET.startWarming, year: BUDGET.startYear },
    (state, step) => {
      const year = BUDGET.startYear + step;
      const emitted = fossilIn(year, pathway) + BUDGET.land;
      const net = emitted - sinkAt(state.level) - Math.max(0, pathway.forest);
      const total = state.total + emitted - Math.max(0, pathway.forest);
      return {
        level: state.level + net / BUDGET.perPpm,
        net,
        total,
        warming: BUDGET.startWarming + (0.45 * total * 3.664) / 1000,
        year,
      };
    }
  );
}
