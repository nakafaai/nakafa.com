import type { StageBudget } from "@repo/design-system/components/three/stage/tier";
import { Match } from "effect";

/**
 * The share of its full face count a living body is drawn with on a stage
 * tier: every face on a desktop GPU, fewer on a phone, half where a CPU
 * draws the scene.
 */
export function bodyDetail(tier: StageBudget["tier"]) {
  return Match.value(tier).pipe(
    Match.when("full", () => 1),
    Match.when("light", () => 0.8),
    Match.when("low", () => 0.6),
    Match.when("plain", () => 0.5),
    Match.exhaustive
  );
}

/** How many faces of `full` a body keeps at a `detail`, never fewer than eight and always even. */
export function faces(full: number, detail: number) {
  return Math.max(8, Math.round((full * detail) / 2) * 2);
}
