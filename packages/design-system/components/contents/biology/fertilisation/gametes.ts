import { Schema } from "effect";

/**
 * The stages of double fertilisation this lab runs through, in order: a
 * pollen grain lands on the stigma, its tube grows down the style, the tube
 * reaches the embryo sac through the micropyle, and the two male gametes
 * fuse, one with the egg and one with the two polar nuclei.
 */
const StageSchema = Schema.Literals(["pollination", "tube", "entry", "fusion"]);
export type Stage = typeof StageSchema.Type;

/** Where each stage starts on the run, from 0 to 1. */
const STAGE_START = {
  entry: 0.62,
  fusion: 0.78,
  pollination: 0,
  tube: 0.12,
} as const;

/** The stage the run has reached at `progress`, from 0 to 1. */
export function stageAt(progress: number): Stage {
  if (progress >= STAGE_START.fusion) {
    return "fusion";
  }
  if (progress >= STAGE_START.entry) {
    return "entry";
  }
  return progress >= STAGE_START.tube ? "tube" : "pollination";
}

/** How far through one stage the run is at `progress`, from 0 to 1. */
export function stageProgress(stage: Stage, progress: number) {
  const ends = {
    entry: STAGE_START.fusion,
    fusion: 1,
    pollination: STAGE_START.tube,
    tube: STAGE_START.entry,
  } as const;
  const start = STAGE_START[stage];
  return Math.min(1, Math.max(0, (progress - start) / (ends[stage] - start)));
}

/**
 * The chromosomes in each nucleus of a seed, for a mother plant whose body
 * cells hold `mother` chromosomes and a father plant whose body cells hold
 * `father`. Each gamete is made by meiosis, so it carries half its parent's
 * set: the egg and each polar nucleus half the mother's, each male gamete
 * half the father's. The embryo grows from egg plus one male gamete; the
 * endosperm from the two polar nuclei plus the other; the seed coat from the
 * ovule's integuments, the mother's own unfertilised tissue.
 */
export function seedChromosomes(mother: number, father: number) {
  const egg = mother / 2;
  const sperm = father / 2;
  return {
    egg,
    embryo: egg + sperm,
    endosperm: 2 * egg + sperm,
    seedCoat: mother,
    sperm,
  };
}

/**
 * What it takes to turn `ovules` ovules into seeds: one pollen tube enters
 * each ovule and carries two male gametes, and both take part in double
 * fertilisation.
 */
export function pollinationNeeds(ovules: number) {
  return { gametes: 2 * ovules, grains: ovules };
}
