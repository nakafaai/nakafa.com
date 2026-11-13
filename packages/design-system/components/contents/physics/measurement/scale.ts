import { mix } from "@repo/design-system/components/contents/physics/canvas/paint";
import { getColor } from "@repo/design-system/lib/color";
import { MATERIAL } from "@repo/design-system/lib/material";
import type p5 from "p5";

/**
 * Painting helpers the measurement sketches share: the engraved marks of a
 * scale and the brushed steel most instruments are made of. Every number a
 * scale carries is written in the card, never on the canvas.
 */

/** The marks of one straight scale, in pixels. */
interface Ticks {
  /** The engraving color. */
  readonly color: string;
  /** How many marks the scale draws, from its first one. */
  readonly count: number;
  /** Which way the marks grow from the edge: up is -1, down is 1. */
  readonly direction: -1 | 1;
  /** The length of a mark by its index, in pixels. */
  readonly length: (index: number) => number;
  /** Where the first mark stands across the canvas. */
  readonly start: number;
  /** The distance between two marks. */
  readonly step: number;
  /** The stroke width of a mark. */
  readonly weight: number;
  /** The edge the marks grow from. */
  readonly y: number;
}

/**
 * The length of the mark at `index` on a scale whose every `major`th mark is
 * long and every `minor`th one middle: `long`, `middle` or `short`.
 */
export function tier(
  index: number,
  every: readonly [major: number, minor: number],
  lengths: readonly [long: number, middle: number, short: number]
) {
  if (index % every[0] === 0) {
    return lengths[0];
  }
  if (index % every[1] === 0) {
    return lengths[1];
  }
  return lengths[2];
}

/** Engraves the marks of a straight scale, each from the scale's edge. */
export function paintTicks(sketch: p5, ticks: Ticks) {
  sketch.push();
  sketch.stroke(ticks.color);
  sketch.strokeWeight(ticks.weight);
  sketch.strokeCap(sketch.SQUARE);
  for (let index = 0; index < ticks.count; index += 1) {
    const x = ticks.start + index * ticks.step;
    sketch.line(x, ticks.y, x, ticks.y + ticks.direction * ticks.length(index));
  }
  sketch.pop();
}

/**
 * The gradient of a polished steel bar lit from above: a bright edge, a
 * darker band where it turns away, and a soft reflection of the bench.
 */
export function steelStops(shade = 0) {
  const light = mix(MATERIAL.chrome, MATERIAL.castIron, shade);
  const dark = mix(MATERIAL.castIron, getColor("ZINC", 900), shade);
  return [
    [0, mix(light, getColor("WHITE"), 0.55)],
    [0.18, light],
    [0.55, mix(light, dark, 0.55)],
    [0.82, dark],
    [1, mix(dark, light, 0.35)],
  ] as const;
}

/**
 * The gradient of a brass or copper cylinder seen from the side, lit from
 * the upper left, run across its width.
 */
export function brassStops(base: string) {
  return [
    [0, mix(base, getColor("BLACK"), 0.45)],
    [0.22, mix(base, getColor("WHITE"), 0.45)],
    [0.4, base],
    [0.85, mix(base, getColor("BLACK"), 0.35)],
    [1, mix(base, getColor("BLACK"), 0.6)],
  ] as const;
}
