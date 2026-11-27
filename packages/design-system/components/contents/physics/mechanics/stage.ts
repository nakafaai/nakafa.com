import { caption } from "@repo/design-system/components/contents/physics/canvas/caption";
import {
  arrow,
  fade,
  gradientRect,
  mix,
  spotlight,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { getColor } from "@repo/design-system/lib/color";
import { ENERGY_COLORS } from "@repo/design-system/lib/material/energy";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { Schema } from "effect";
import type p5 from "p5";

/**
 * Painting for the mechanics labs that are still sketches: a lab with a
 * plastered wall and a polished floor, and force arrows with their symbols
 * at the tip.
 */

/** A point on the canvas, in pixels. */
const PointSchema = Schema.Struct({ x: Schema.Finite, y: Schema.Finite });
type Point = typeof PointSchema.Type;

/** The wall and the floor, with the floor's top edge at `floor`. */
export function paintRoom(sketch: p5, floor: number) {
  const { height, width } = sketch;
  gradientRect(sketch, { height: floor, width, x: 0, y: 0 }, [
    [0, mix(ENERGY_COLORS.wallPlaster, getColor("BLACK"), 0.5)],
    [1, mix(ENERGY_COLORS.wallPlaster, getColor("BLACK"), 0.28)],
  ]);
  spotlight(sketch, { x: width * 0.5, y: floor * 0.3 }, width * 0.6, {
    color: INSTRUMENT_COLORS.lampLight,
    strength: 0.18,
  });
  gradientRect(sketch, { height: height - floor, width, x: 0, y: floor }, [
    [0, mix(INSTRUMENT_COLORS.oak, getColor("WHITE"), 0.05)],
    [1, mix(INSTRUMENT_COLORS.oak, getColor("BLACK"), 0.5)],
  ]);
  sketch.stroke(fade(getColor("BLACK"), 0.35));
  sketch.strokeWeight(1);
  sketch.line(0, floor, width, floor);
}

/** A force arrow from `from` to `to` with its symbol, such as `F` or `T`, beside the tip. */
export function force(
  sketch: p5,
  from: Point,
  to: Point,
  color: string,
  symbol: string
) {
  arrow(sketch, from, to, { color, head: 11, weight: 3.5 });
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  caption(
    sketch,
    symbol,
    {
      x: to.x + (dx / length) * 10 + (dy / length) * 8,
      y: to.y + (dy / length) * 10 - (dx / length) * 8,
    },
    {
      align: "center",
      baseline: "middle",
      color,
      size: 14,
    }
  );
}
