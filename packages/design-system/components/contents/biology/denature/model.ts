import { Option, Schema } from "effect";

const DenatureEnzymeSchema = Schema.Literals(["amylase", "pepsin"]);
export type DenatureEnzyme = typeof DenatureEnzymeSchema.Type;

const DenatureMetricsSchema = Schema.Struct({
  collisions: Schema.Finite,
  endpoint: Schema.Option(Schema.Finite),
  intactShare: Schema.Finite,
  relativeRate: Schema.Finite,
});
type DenatureMetrics = typeof DenatureMetricsSchema.Type;

export const OPTIMUM_TEMPERATURE = 37;
export const OPTIMUM_PH = 2;
export const MAX_TIME_MINUTES = 20;

/**
 * Computes irreversible active-site denaturation caused by high temperature
 * on salivary amylase: intact up to 45 C, dropping smoothly to 0 by 65 C.
 */
export function amylaseIntactAt(peakTemperature: number): number {
  if (peakTemperature <= 45) {
    return 1;
  }
  if (peakTemperature >= 65) {
    return 0;
  }
  return 1 - (peakTemperature - 45) / 20;
}

/**
 * Computes active-site integrity of gastric pepsin across pH: optimal near
 * pH 2, losing integrity steeply above pH 4.5 or below pH 0.5.
 */
export function pepsinIntactAt(ph: number): number {
  const distance = Math.abs(ph - OPTIMUM_PH);
  if (distance <= 1.2) {
    return 1;
  }
  if (distance >= 4.2) {
    return 0;
  }
  return 1 - (distance - 1.2) / 3;
}

/**
 * Calculates reaction kinetics for salivary amylase at a current water-bath
 * temperature and historical peak temperature (capturing irreversible heat
 * denaturation when cooled back to 37 C).
 */
export function evaluateAmylase(
  temperature: number,
  peakTemperature: number
): DenatureMetrics {
  const intactShare = amylaseIntactAt(Math.max(temperature, peakTemperature));
  const kineticFactor = Math.max(0.05, Math.min(1.4, (temperature + 5) / 42));
  const rawRate = intactShare * Math.min(1, kineticFactor);
  const relativeRate = Math.round(rawRate * 100) / 100;
  const collisions = Math.round(relativeRate * 120);
  const endpoint =
    relativeRate <= 0.04
      ? Option.none<number>()
      : Option.some(Math.round((2 / relativeRate) * 10) / 10);
  return { collisions, endpoint, intactShare, relativeRate };
}

/** Calculates reaction kinetics for gastric pepsin at a chosen solution pH. */
export function evaluatePepsin(ph: number, minIntact: number): DenatureMetrics {
  const currentIntact = pepsinIntactAt(ph);
  const intactShare = Math.min(currentIntact, minIntact);
  const closeness = Math.exp(-((ph - OPTIMUM_PH) ** 2) / 4.5);
  const relativeRate = Math.round(intactShare * closeness * 100) / 100;
  const collisions = Math.round(relativeRate * 110);
  const endpoint =
    relativeRate <= 0.04
      ? Option.none<number>()
      : Option.some(Math.round((2.5 / relativeRate) * 10) / 10);
  return { collisions, endpoint, intactShare, relativeRate };
}

/** Returns whether substrate digestion has reached its endpoint by `minutes`. */
export function isDigestedAt(
  endpoint: Option.Option<number>,
  minutes: number
): boolean {
  return Option.match(endpoint, {
    onNone: () => false,
    onSome: (doneAt) => minutes >= doneAt,
  });
}
