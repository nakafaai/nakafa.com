import { Array as Arr, Match, Schema } from "effect";

/**
 * The oxygen debt of a working muscle, on the lesson's teaching curves.
 *
 * A person rests, exercises from minute 2 to minute 8, and recovers until
 * minute 16. Oxygen uptake, in litres a minute, is `rest` at rest; during
 * exercise the muscles need `rest + work` but uptake only climbs towards it,
 * `rest + work (1 - e^-(t - 2))`; after exercise it falls back,
 * `rest + work (1 - e^-6) e^-((t - 8) / 2)`. These are the curves of the
 * lesson's oxygen-debt graph, so the lab and the graph agree.
 *
 * They are simplified exponential kinetics. Measured pulmonary oxygen uptake
 * rises at exercise onset with a phase II time constant of about 35 s
 * (35 ± 14 s at moderate intensity; Rossiter et al. 2002, J Physiol
 * 541:991, https://pmc.ncbi.nlm.nih.gov/articles/PMC2290368), against the
 * lesson's 1 minute. After exercise the excess post-exercise oxygen
 * consumption (EPOC) has a rapid component (oxygen stores, ATP and creatine
 * phosphate, lactate) and a prolonged one that can last hours (Børsheim &
 * Bahr 2003, Sports Med 33:1037; Gaesser & Brooks 1984, Med Sci Sports Exerc
 * 16:29), against the lesson's single 2 minute time constant ending at minute
 * 16.
 */

/** The minutes that frame the run: exercise starts, exercise stops, the record ends. */
export const RUN = { close: 16, end: 8, start: 2 } as const;

/** The lesson's time constant of the rise in uptake at the start of exercise, in minutes. */
const RISE = 1;

/** The lesson's time constant of the fall in uptake after exercise, in minutes. */
const FALL = 2;

/** Where the run is: resting before exercise, exercising, or recovering after it. */
const StageSchema = Schema.Literals(["rest", "exercise", "recovery"]);
export type Stage = typeof StageSchema.Type;

/** The stage of the run at `minute`. */
export function stageAt(minute: number): Stage {
  if (minute < RUN.start) {
    return "rest";
  }
  return minute <= RUN.end ? "exercise" : "recovery";
}

/** How far uptake has climbed towards demand during exercise, 0 to 1, after `minutes` of exercise. */
function climbed(minutes: number) {
  return 1 - Math.exp(-minutes / RISE);
}

/** The oxygen the muscles need at `minute`, in litres a minute. */
export function demand(minute: number, rest: number, work: number) {
  return stageAt(minute) === "exercise" ? rest + work : rest;
}

/** The oxygen taken up at `minute`, in litres a minute, on the lesson's curves. */
export function uptake(minute: number, rest: number, work: number) {
  return Match.value(stageAt(minute)).pipe(
    Match.when("rest", () => rest),
    Match.when("exercise", () => rest + work * climbed(minute - RUN.start)),
    Match.when(
      "recovery",
      () =>
        rest +
        work *
          climbed(RUN.end - RUN.start) *
          Math.exp(-(minute - RUN.end) / FALL)
    ),
    Match.exhaustive
  );
}

/**
 * The oxygen shortfall so far at `minute`, in litres: the area between demand
 * and uptake since exercise began, ∫ work e^-(t - 2) dt from minute 2. The
 * muscles cover it with lactic acid fermentation.
 */
export function shortfall(minute: number, work: number) {
  const exercised = Math.min(Math.max(minute, RUN.start), RUN.end) - RUN.start;
  return work * RISE * climbed(exercised);
}

/**
 * The oxygen debt repaid so far at `minute`, in litres: the area of uptake
 * above the resting rate since exercise stopped,
 * ∫ work (1 - e^-6) e^-((t - 8) / 2) dt from minute 8.
 */
export function repaid(minute: number, work: number) {
  const recovered = Math.min(Math.max(minute, RUN.end), RUN.close) - RUN.end;
  return (
    work *
    climbed(RUN.end - RUN.start) *
    FALL *
    (1 - Math.exp(-recovered / FALL))
  );
}

/**
 * The lactic acid in the muscle fibres at `minute`, 0 to 1 of the most the
 * lab can show, which is the shortfall at the end of exercise at the highest
 * demand `most`. Fermentation makes lactic acid in step with the shortfall
 * (OpenStax Anatomy and Physiology 2e, 10.3: pyruvic acid "is converted to
 * lactic acid" when oxygen is short). After exercise the lab clears it in step
 * with the debt being repaid, since the debt's oxygen converts lactic acid back
 * to pyruvic acid and, in the liver, to glucose or glycogen (same section).
 * Measured blood lactate falls more slowly, with a half-time of about 7 to 15
 * minutes after hard exercise, and its removal does not track the slow EPOC
 * component closely (Gaesser & Brooks 1984); the lab keeps the lesson's
 * account.
 */
export function lactic(minute: number, work: number, most: number) {
  const peak = shortfall(minute, work) / shortfall(RUN.end, most);
  const owed = repaid(RUN.close, work);
  return peak * (1 - repaid(minute, work) / owed);
}

/**
 * How fast lactic acid leaves the fibres for the blood at `minute`, in the
 * lab's relative units a minute: the fall of `lactic`, which follows the
 * uptake above rest during recovery and is zero before it.
 */
export function clearance(
  minute: number,
  rest: number,
  work: number,
  most: number
) {
  if (stageAt(minute) !== "recovery") {
    return 0;
  }
  const peak = shortfall(RUN.end, work) / shortfall(RUN.end, most);
  return (peak * (uptake(minute, rest, work) - rest)) / repaid(RUN.close, work);
}

/**
 * The largest share of its force a muscle loses to fatigue in the lab, at the
 * most lactic acid it shows. Maximal quadriceps force falls by about 25%
 * after long cycling or running (Brownstein & Millet, ACSM,
 * https://acsm.org/exercise-modality-muscle-fatigue). Fatigue has several
 * causes: OpenStax Anatomy and
 * Physiology 2e, 10.3, names ATP running short, ion imbalance, and lactic
 * acid that "may lower intracellular pH"; the lab ties it to lactic acid alone.
 */
const FATIGUE = 0.25;

/** The force the fibres still give, 0 to 1 of their rested force, at a lactic acid level of `level`. */
export function force(level: number) {
  return 1 - FATIGUE * level;
}

/**
 * The length of a thick (myosin) filament, in micrometres: about 1.65 µm in
 * every vertebrate skeletal muscle (Gokhin et al. 2012, Am J Physiol Cell
 * Physiol 302:C555, https://pmc.ncbi.nlm.nih.gov/articles/PMC3287155). It is
 * the A band, which keeps its width while the muscle contracts (OpenStax
 * Anatomy and Physiology 2e, 10.3, Figure 10.10).
 */
export const THICK = 1.65;

/**
 * The length of a thin (actin) filament from the Z disc, in micrometres: the
 * middle of the 1.19 to 1.37 µm measured in human deltoid and pectoralis
 * (Gokhin et al. 2012).
 */
export const THIN = 1.28;

/**
 * A relaxed sarcomere, Z disc to Z disc, in micrometres: two thin filaments
 * plus the thick filament's bare middle of about 0.15 to 0.2 µm (Gordon,
 * Huxley & Julian 1966, J Physiol 184:170), the length at which every myosin
 * head still reaches actin. OpenStax rounds a sarcomere to "approximately
 * 2 μm" (10.2).
 */
export const RELAXED = 2.7;

/**
 * The sarcomere at the lab's strongest contraction, in micrometres: 19%
 * shorter than relaxed, inside the 36 ± 25% of optimal length that vertebrate
 * muscles span in movement (Burkholder & Lieber 2001, J Exp Biol 204:1529).
 */
export const SHORTENED = 2.2;

/**
 * The length of each sarcomere, in micrometres, when the fibre is `drive` of
 * the way into a contraction (0 relaxed, 1 at its peak) with `strength` of its
 * rested force left.
 */
export function sarcomere(drive: number, strength: number) {
  return RELAXED - (RELAXED - SHORTENED) * drive * strength;
}

/**
 * The bands of a sarcomere `length` micrometres long: the I band, thin
 * filaments alone, on both sides of a Z disc; and the H zone, the middle of the
 * A band that thin filaments do not reach, gone once they meet. In contraction
 * the I band and H zone narrow while the A band keeps its width.
 */
export function bands(length: number) {
  return {
    h: Math.max(0, length - 2 * THIN),
    i: length - THICK,
  };
}

/**
 * How far oxygen uptake stands above rest at `minute`, as a share of the
 * highest demand `most` the lab offers: 0 at rest, 1 at the end of the
 * hardest exercise. Blood carries the oxygen taken up, so the lab scales the
 * flow through the capillaries by it, and it stays high while the debt is
 * repaid.
 */
export function effort(
  minute: number,
  rest: number,
  work: number,
  most: number
) {
  return (uptake(minute, rest, work) - rest) / most;
}

/**
 * Red blood cells in a muscle capillary at rest and just after contractions
 * (Kindig, Richardson & Poole 2002, J Appl Physiol 92:2513, rat
 * spinotrapezius): `speed` in micrometres a second (270 ± 62 and 428 ± 47
 * µm/s) and `flux` in cells a second (22.4 ± 5.5 and 44.3 ± 5.5).
 */
export const CAPILLARY = {
  rest: { flux: 22.4, speed: 270 },
  work: { flux: 44.3, speed: 428 },
} as const;

/** The speed of red blood cells through the capillaries at `minute`, in micrometres a second. */
export function flow(minute: number, rest: number, work: number, most: number) {
  const { rest: still, work: working } = CAPILLARY;
  return (
    still.speed +
    (working.speed - still.speed) * effort(minute, rest, work, most)
  );
}

/**
 * How many red blood cells a micrometre of capillary holds at `minute`: the
 * flux over the speed, about one cell every 12 µm at rest and every 10 µm
 * after contractions.
 */
export function crowding(
  minute: number,
  rest: number,
  work: number,
  most: number
) {
  const { rest: still, work: working } = CAPILLARY;
  const flux =
    still.flux + (working.flux - still.flux) * effort(minute, rest, work, most);
  return flux / flow(minute, rest, work, most);
}

/** The uptake curve of the whole run at `steps` + 1 evenly spaced minutes, for the card's trace. */
export function trace(rest: number, work: number, steps: number) {
  return Arr.map(Arr.range(0, steps), (step) => {
    const minute = (RUN.close * step) / steps;
    return { minute, uptake: uptake(minute, rest, work) };
  });
}
