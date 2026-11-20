import type { Footing } from "@/lib/island/steps";
import type { Shot } from "@/lib/island/tape";
import { bendOf, shotOf } from "@/lib/island/tape";

/**
 * The recording each footing is heard as (ADR 0047, D40; ADR 0050, W8), how
 * loud and how fast it plays, and after how many seconds it is cut, 0 for
 * the whole step: grass and meadow a step in grass, a beach a step in sand,
 * a forest's floor the same grass slowed until it is dull, a path's gravel
 * and a rock face a step on stone, lower on the gravel, a bridge's deck a
 * step on wood, and water a short splash.
 */
const STEPS = {
  grass: { cut: 0, file: "step-grass", loud: 0.5, rate: 1 },
  gravel: { cut: 0, file: "step-stone", loud: 0.4, rate: 0.9 },
  sand: { cut: 0, file: "step-sand", loud: 0.45, rate: 1 },
  soil: { cut: 0, file: "step-grass", loud: 0.55, rate: 0.78 },
  stone: { cut: 0, file: "step-stone", loud: 0.45, rate: 1.15 },
  water: { cut: 0.3, file: "splash", loud: 0.1, rate: 1.7 },
  wood: { cut: 0, file: "step-wood", loud: 0.5, rate: 1 },
} as const satisfies Record<Footing, Omit<Shot, "delay" | "pan">>;

/**
 * One footstep of the fox on a footing, the `count`-th of its walk: the
 * footing's recording, left and right in turn, bent a little by its place in
 * the walk so a long one never repeats one sound.
 */
export function treadOf(footing: Footing, count: number) {
  const step = STEPS[footing];
  return shotOf(step.file, step.loud, {
    cut: step.cut,
    pan: count % 2 === 0 ? -0.18 : 0.18,
    rate: step.rate * bendOf(83, count, 220),
  });
}
