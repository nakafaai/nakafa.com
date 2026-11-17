import { caption } from "@repo/design-system/components/contents/physics/canvas/caption";
import {
  fade,
  gradientRect,
  mix,
  spotlight,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import type { Point } from "@repo/design-system/components/contents/physics/optics/light";
import { getColor } from "@repo/design-system/lib/color";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { ENERGY_COLORS } from "@repo/design-system/lib/material/energy";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { REAGENT_COLORS } from "@repo/design-system/lib/material/reagent";
import type p5 from "p5";

/**
 * Painting for the heat labs: a lab bench under a lamp, a glass beaker or an
 * insulated cup, the liquid in it, and a mercury thermometer whose column
 * stands at the temperature it reads.
 */

/** The bench and the wall behind it, with the bench top from `top` down. */
export function paintBench(sketch: p5, top: number) {
  const { height, width } = sketch;
  gradientRect(sketch, { height: top, width, x: 0, y: 0 }, [
    [0, mix(ENERGY_COLORS.wallPlaster, getColor("BLACK"), 0.55)],
    [1, mix(ENERGY_COLORS.wallPlaster, getColor("BLACK"), 0.35)],
  ]);
  spotlight(sketch, { x: width * 0.45, y: top * 0.4 }, width * 0.6, {
    color: INSTRUMENT_COLORS.lampLight,
    strength: 0.22,
  });
  gradientRect(sketch, { height: height - top, width, x: 0, y: top }, [
    [0, BENCH_COLORS.epoxy],
    [1, mix(BENCH_COLORS.epoxy, getColor("BLACK"), 0.5)],
  ]);
}

/** A glass beaker standing on the bench with its liquid `filled` of its height, its rim at `rim`. */
export function paintBeaker(
  sketch: p5,
  box: {
    readonly height: number;
    readonly width: number;
    readonly x: number;
    readonly y: number;
  },
  filled: number,
  liquid: string
) {
  const level = box.y + box.height * (1 - filled);
  gradientRect(
    sketch,
    {
      height: box.y + box.height - level,
      width: box.width,
      x: box.x,
      y: level,
    },
    [
      [0, fade(mix(liquid, getColor("WHITE"), 0.2), 0.75)],
      [1, fade(mix(liquid, getColor("BLACK"), 0.25), 0.85)],
    ]
  );
  sketch.noFill();
  sketch.stroke(fade(BENCH_COLORS.glass, 0.8));
  sketch.strokeWeight(3);
  sketch.line(box.x, box.y, box.x, box.y + box.height);
  sketch.line(box.x + box.width, box.y, box.x + box.width, box.y + box.height);
  sketch.line(box.x, box.y + box.height, box.x + box.width, box.y + box.height);
  sketch.stroke(fade(getColor("WHITE"), 0.35));
  sketch.strokeWeight(2);
  sketch.line(
    box.x + box.width * 0.12,
    box.y + box.height * 0.1,
    box.x + box.width * 0.12,
    box.y + box.height * 0.85
  );
}

/**
 * A mercury thermometer from `top` to its bulb at `bottom`, reading
 * `temperature` on a scale from `low` to `high` degrees Celsius, with its
 * `reading`, already written in the reader's locale, level with the top of
 * the column at `label` across the canvas.
 */
export function paintThermometer(
  sketch: p5,
  place: {
    readonly bottom: Point;
    readonly label: number;
    readonly top: number;
  },
  scale: {
    readonly high: number;
    readonly low: number;
    readonly reading: string;
    readonly temperature: number;
  }
) {
  const { bottom, top } = place;
  const tall = bottom.y - top;
  sketch.noStroke();
  sketch.fill(fade(BENCH_COLORS.glass, 0.85));
  sketch.rect(bottom.x - 6, top, 12, tall, 6);
  sketch.fill(REAGENT_COLORS.mercury);
  sketch.circle(bottom.x, bottom.y, 18);
  const share = Math.min(
    Math.max((scale.temperature - scale.low) / (scale.high - scale.low), 0),
    1
  );
  sketch.fill(INSTRUMENT_COLORS.dialNeedle);
  sketch.circle(bottom.x, bottom.y, 13);
  sketch.rect(bottom.x - 2.5, bottom.y - tall * share, 5, tall * share);
  sketch.stroke(fade(getColor("NEUTRAL", 800), 0.7));
  sketch.strokeWeight(1);
  for (let mark = 0; mark <= 10; mark += 1) {
    const y = bottom.y - (tall * mark) / 10;
    sketch.line(bottom.x + 6, y, bottom.x + (mark % 5 === 0 ? 12 : 9), y);
  }
  caption(
    sketch,
    scale.reading,
    { x: place.label, y: bottom.y - tall * share },
    {
      align: "left",
      baseline: "middle",
      color: getColor("WHITE"),
      size: 13,
    }
  );
}
