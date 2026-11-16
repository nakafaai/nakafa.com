import {
  type Frame,
  type Point,
  waterOf,
} from "@repo/design-system/components/contents/biology/climate/frame";
import {
  clipTo,
  painted,
  shape,
  stopped,
  tint,
} from "@repo/design-system/components/contents/biology/climate/paint";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr } from "effect";
import type p5 from "p5";

/**
 * The stream from the filler down to the surface, `wide` as the year's
 * emissions: a splash and droplets where it lands, and a plume of bubbles it
 * drives under the surface.
 */
export function drawPour(
  sketch: p5,
  frame: Frame,
  surface: number,
  time: number,
  wide: number
) {
  drawStream(sketch, frame, [frame.spout, frame.nozzle], surface, time, wide);
  drawSplash(sketch, frame, [frame.spout, surface], time, wide);
  const plume = Math.min(frame.bottom - surface - 4, wide * 7);
  if (plume <= 0) {
    return;
  }
  sketch.push();
  clipTo(sketch, waterOf(frame, surface));
  sketch.noFill();
  sketch.strokeWeight(Math.max(0.6, 0.8 * frame.unit));
  Arr.forEach(Arr.range(0, 15), (bubble) => {
    const phase = (time * 0.9 + hashUnit(bubble, 11)) % 1;
    sketch.stroke(tint(sketch, MATERIAL.waterGlint, 210 * (1 - phase)));
    sketch.circle(
      frame.spout + (hashUnit(bubble, 13) - 0.5) * wide * (0.6 + phase * 2.4),
      surface + phase * plume,
      (1.2 + hashUnit(bubble, 17) * 2.4) * frame.unit * (1 - phase * 0.4)
    );
  });
  sketch.pop();
}

/** The stream out of the open waste down into the floor grate, `wide` as the year's uptake. */
export function drawSpill(
  sketch: p5,
  frame: Frame,
  time: number,
  wide: number
) {
  const [x] = frame.outlet;
  drawStream(sketch, frame, frame.outlet, frame.ground, time, wide);
  drawSplash(sketch, frame, [x, frame.ground], time, wide);
}

/**
 * A stream falling from `start` down to `to`, `wide` where it leaves the
 * pipe and narrowing as it speeds up: glassy, teal at its edges with a bright
 * core, swaying a little, with glints running down it.
 */
function drawStream(
  sketch: p5,
  frame: Frame,
  [x, from]: Point,
  to: number,
  time: number,
  wide: number
) {
  const heights = Arr.map(
    Arr.range(0, 18),
    (step) => from + ((to - from) * step) / 18
  );
  const half = (y: number) =>
    wide / 2 / (1 + (y - from) / (frame.height * 0.25)) ** 0.25;
  const sway = (y: number) =>
    Math.sin(y * 0.09 - time * 14) * 0.35 * frame.unit;
  painted(
    sketch,
    tint(sketch, MATERIAL.bathwater, 200),
    (context) =>
      stopped(context.createLinearGradient(x - wide / 2, 0, x + wide / 2, 0), [
        [0, tint(sketch, MATERIAL.seawater, 215)],
        [0.24, tint(sketch, MATERIAL.bathwater, 170)],
        [0.4, tint(sketch, MATERIAL.waterGlint, 240)],
        [0.58, tint(sketch, MATERIAL.bathwater, 150)],
        [1, tint(sketch, MATERIAL.seawater, 215)],
      ]),
    () =>
      shape(
        sketch,
        Arr.appendAll(
          Arr.map(heights, (y): Point => [x - half(y) + sway(y), y]),
          Arr.map(
            Arr.reverse(heights),
            (y): Point => [x + half(y) + sway(y), y]
          )
        )
      )
  );
  sketch.push();
  sketch.strokeCap(sketch.ROUND);
  sketch.stroke(tint(sketch, MATERIAL.porcelainGloss, 220));
  sketch.strokeWeight(Math.max(0.8, wide * 0.12));
  Arr.forEach(Arr.range(0, 2), (glint) => {
    const y = from + ((time * 1.6 + glint / 3) % 1) * (to - from);
    const reach = Math.min(to, y + 7 * frame.unit);
    sketch.line(
      x - half(y) * 0.3 + sway(y),
      y,
      x - half(reach) * 0.3 + sway(reach),
      reach
    );
  });
  sketch.pop();
}

/** Foam and droplets thrown up where a stream `wide` lands at `x`, `y`. */
function drawSplash(
  sketch: p5,
  frame: Frame,
  [x, y]: Point,
  time: number,
  wide: number
) {
  sketch.push();
  sketch.noStroke();
  sketch.fill(tint(sketch, MATERIAL.waterGlint, 190));
  Arr.forEach(Arr.range(0, 2), (foam) =>
    sketch.ellipse(
      x + (hashUnit(foam, 3) - 0.5) * wide * 1.8,
      y,
      wide * (0.7 + hashUnit(foam, 4) * 0.6),
      2.2 * frame.unit
    )
  );
  Arr.forEach(Arr.range(0, 5), (drop) => {
    const phase = (time * 1.8 + hashUnit(drop, 7)) % 1;
    const throwX = (hashUnit(drop, 8) - 0.5) * wide * 3.2;
    const throwY = (0.4 + hashUnit(drop, 9)) * wide * 1.4;
    sketch.fill(tint(sketch, MATERIAL.waterGlint, 230 * (1 - phase)));
    sketch.circle(
      x + throwX * phase,
      y - throwY * 4 * phase * (1 - phase),
      (1.6 - phase * 0.6) * frame.unit
    );
  });
  sketch.pop();
}
