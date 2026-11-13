import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { Array as Arr } from "effect";

/**
 * A SARS-CoV-2 virion carries about 26 spikes, 15 either way, by
 * cryo-electron tomography of intact virions (Ke et al., Nature 588, 2020);
 * the card draws 24.
 */
export const SPIKES = 24;

/**
 * How tightly a strong neutralising antibody holds a spike: half the spikes
 * are bound at about 1 nM, the dissociation constant reported for potent
 * antibodies such as those of Barnes et al. (Nature 588, 2020).
 */
export const DISSOCIATION = 1;

/**
 * In the card's model a virion can no longer dock once antibodies cover three
 * quarters of its spikes, so too few remain to reach a receptor.
 */
export const BLOCKING = 18;

/** The share of spikes an antibody holds at concentration `nanomolar`. */
export function occupancyOf(nanomolar: number) {
  const level = Math.max(0, nanomolar);
  return level / (level + DISSOCIATION);
}

/** Which of virion `virion`'s spikes hold an antibody at occupancy `share`. */
export function boundSpikes(virion: number, share: number) {
  return Arr.map(
    Arr.range(0, SPIKES - 1),
    (spike) => hashUnit(virion, spike) < share
  );
}

/** Whether antibodies cover enough of a virion's spikes to stop it docking. */
export function isBlocked(bound: readonly boolean[]) {
  return Arr.length(Arr.filter(bound, Boolean)) >= BLOCKING;
}

/** The chance that at least `BLOCKING` of the spikes are bound, each with chance `share`. */
export function blockedChance(share: number) {
  return Arr.reduce(
    Arr.range(BLOCKING, SPIKES),
    0,
    (sum, bound) =>
      sum +
      choose(SPIKES, bound) * share ** bound * (1 - share) ** (SPIKES - bound)
  );
}

/**
 * Antibody level in the blood on `day` after a first vaccine dose, in nM:
 * hardly any in the first week, rising over the second, and close to its
 * peak of 20 nM by the third week. A smooth S-curve for teaching, after the
 * timing of seroconversion that vaccine trials report.
 */
export function levelOnDay(day: number) {
  return 20 / (1 + Math.exp(-(day - 11) / 2));
}

/** The number of ways to pick `k` of `n`. */
function choose(n: number, k: number) {
  return Arr.reduce(
    Arr.range(1, k),
    1,
    (product, step) => (product * (n - k + step)) / step
  );
}

/**
 * Where spike `index` of `count` stands on a virion of radius 1: spread evenly
 * over the sphere along a golden-angle spiral, so no two crowd together.
 */
export function spikeAnchor(index: number, count: number) {
  const y = 1 - (2 * (index + 0.5)) / count;
  const ring = Math.sqrt(1 - y * y);
  const angle = index * Math.PI * (3 - Math.sqrt(5));
  return [Math.cos(angle) * ring, y, Math.sin(angle) * ring] as const;
}
