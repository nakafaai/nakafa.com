import { caption } from "@repo/design-system/components/contents/physics/canvas/caption";
import {
  fade,
  gradientRect,
  mix,
  spotlight,
  withShadow,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import type { Point } from "@repo/design-system/components/contents/physics/optics/light";
import { getColor } from "@repo/design-system/lib/color";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { REAGENT_COLORS } from "@repo/design-system/lib/material/reagent";
import type p5 from "p5";

/**
 * Parts for the electronics labs, as they sit on a circuit board: a
 * transistor in its black package with its three legs marked, a
 * light-dependent resistor with its snaking track, and the chips and
 * light-emitting diodes of a logic trainer.
 */

/** An npn transistor in a black package at `at`, its legs ending at the returned emitter, base and collector points. */
export function paintTransistor(sketch: p5, at: Point, size: number) {
  withShadow(
    sketch,
    { blur: 8, color: fade(getColor("BLACK"), 0.5), drop: 3 },
    () => {
      sketch.noStroke();
      sketch.fill(getColor("ZINC", 900));
      sketch.arc(at.x, at.y, size, size * 1.1, Math.PI, Math.PI * 2);
      sketch.rect(at.x - size / 2, at.y, size, size * 0.25);
    }
  );
  sketch.fill(fade(getColor("WHITE"), 0.15));
  sketch.rect(at.x - size * 0.4, at.y - size * 0.4, size * 0.2, size * 0.5, 3);
  const legs = {
    base: { x: at.x, y: at.y + size * 0.9 },
    collector: { x: at.x + size * 0.32, y: at.y + size * 0.9 },
    emitter: { x: at.x - size * 0.32, y: at.y + size * 0.9 },
  };
  sketch.stroke(BENCH_COLORS.probeSteel);
  sketch.strokeWeight(2);
  for (const leg of [legs.emitter, legs.base, legs.collector]) {
    sketch.line(leg.x, at.y + size * 0.25, leg.x, leg.y);
  }
  const mark = {
    align: "center",
    baseline: "top",
    color: fade(getColor("WHITE"), 0.85),
    size: Math.max(10, size * 0.22),
  } as const;
  caption(sketch, "e", { x: legs.emitter.x, y: legs.emitter.y + 3 }, mark);
  caption(sketch, "b", { x: legs.base.x, y: legs.base.y + 3 }, mark);
  caption(sketch, "c", { x: legs.collector.x, y: legs.collector.y + 3 }, mark);
  return legs;
}

/** A light-dependent resistor at `at`, its window lit by `light` from 0 (dark) to 1 (bright). */
export function paintLdr(sketch: p5, at: Point, size: number, light: number) {
  spotlight(sketch, at, size * 1.6, {
    color: INSTRUMENT_COLORS.lampLight,
    strength: 0.5 * light,
  });
  sketch.noStroke();
  sketch.fill(mix(BENCH_COLORS.dish, getColor("WHITE"), 0.3));
  sketch.circle(at.x, at.y, size);
  sketch.fill(mix(REAGENT_COLORS.calx, BENCH_COLORS.coalGlow, 0.3));
  sketch.circle(at.x, at.y, size * 0.8);
  sketch.noFill();
  sketch.stroke(mix(BENCH_COLORS.dish, getColor("WHITE"), 0.5));
  sketch.strokeWeight(Math.max(1.5, size * 0.06));
  const rows = 5;
  for (let row = 0; row < rows; row += 1) {
    const y = at.y - size * 0.3 + (row * size * 0.6) / (rows - 1);
    sketch.line(at.x - size * 0.28, y, at.x + size * 0.28, y);
  }
}

/** A light-emitting diode at `at`, lit when `on`, in `color`. */
export function paintLed(
  sketch: p5,
  at: Point,
  size: number,
  on: boolean,
  color: string
) {
  if (on) {
    spotlight(sketch, at, size * 2.5, { color, strength: 0.7 });
  }
  sketch.noStroke();
  sketch.fill(
    on
      ? mix(color, getColor("WHITE"), 0.35)
      : fade(mix(color, getColor("BLACK"), 0.55), 0.9)
  );
  sketch.circle(at.x, at.y, size);
  sketch.fill(fade(getColor("WHITE"), on ? 0.7 : 0.25));
  sketch.circle(at.x - size * 0.18, at.y - size * 0.18, size * 0.28);
}

/** A logic chip in its black package from `x`, `y`, `width` by `height`, with `name` printed on it. */
export function paintChip(
  sketch: p5,
  box: {
    readonly height: number;
    readonly width: number;
    readonly x: number;
    readonly y: number;
  },
  name: string
) {
  withShadow(
    sketch,
    { blur: 8, color: fade(getColor("BLACK"), 0.5), drop: 3 },
    () => {
      gradientRect(sketch, box, [
        [0, getColor("ZINC", 900)],
        [1, getColor("ZINC", 950)],
      ]);
    }
  );
  sketch.stroke(BENCH_COLORS.probeSteel);
  sketch.strokeWeight(2);
  for (let pin = 0; pin < 4; pin += 1) {
    const x = box.x + (box.width * (pin + 0.5)) / 4;
    sketch.line(x, box.y - 5, x, box.y);
    sketch.line(x, box.y + box.height, x, box.y + box.height + 5);
  }
  caption(
    sketch,
    name,
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    {
      align: "center",
      baseline: "middle",
      color: fade(getColor("WHITE"), 0.9),
      size: Math.min(14, box.height * 0.35),
    }
  );
}
