import {
  drawFiller,
  drawFloor,
  drawFoot,
  drawWaste,
} from "@repo/design-system/components/contents/biology/climate/fittings";
import {
  type Frame,
  frameOf,
  insideAt,
  markOf,
  outline,
  outsideAt,
  type Point,
  surfaceOf,
  waterOf,
} from "@repo/design-system/components/contents/biology/climate/frame";
import {
  chromeAcross,
  clipTo,
  painted,
  shape,
  stopped,
  tint,
  trace,
} from "@repo/design-system/components/contents/biology/climate/paint";
import {
  drawPour,
  drawSpill,
} from "@repo/design-system/components/contents/biology/climate/stream";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";

/** How wide a stream runs per GtC a year, in pixels of a 720 px wide sketch. */
const STREAM_PER_GTC = 0.9;

/** The narrowest stream drawn, in pixels, so a trickle still shows. */
const TRICKLE = 1.5;

/** What the tub shows: the CO2 level in ppm, and what flows in and out a year in GtC. */
const FlowSchema = Schema.Struct({
  emitted: Schema.Finite,
  level: Schema.Finite,
  taken: Schema.Finite,
});

/**
 * The bathtub with its water at the CO2 `level`, its feet, its filler and its
 * waste. While the model runs, the filler pours as wide as the year's
 * emissions and the waste spills as wide as the year's uptake, at the same
 * width per GtC; reading the record, the tap is shut and the plug is in.
 */
export function drawTub(
  sketch: p5,
  flow: typeof FlowSchema.Type,
  record: boolean
) {
  const frame = frameOf(sketch);
  const surface = surfaceOf(frame, flow.level);
  const time = sketch.frameCount / 60;
  const widthOf = (gigatonnes: number) =>
    Math.max(TRICKLE, gigatonnes * STREAM_PER_GTC * frame.unit);
  drawFloor(sketch, frame, !record);
  drawWaste(sketch, frame);
  drawFoot(sketch, frame, frame.left + frame.width * 0.08);
  drawFoot(sketch, frame, frame.right - frame.width * 0.06);
  drawShell(sketch, frame);
  drawPlug(sketch, frame, record);
  drawWater(sketch, frame, surface, time);
  drawMark(sketch, frame);
  drawRim(sketch, frame);
  drawFiller(sketch, frame);
  if (record) {
    return;
  }
  drawPour(sketch, frame, surface, time, widthOf(flow.emitted));
  drawSpill(sketch, frame, time, widthOf(flow.taken));
}

/**
 * The enamelled shell: its outside lit from the upper left and shaded where
 * it curves under, and the glazed back wall, darker in the corners and where
 * it turns into the floor.
 */
function drawShell(sketch: p5, frame: Frame) {
  const shell = outline(frame.top, frame.base, (y, side) =>
    outsideAt(frame, y, side)
  );
  const inside = outline(frame.top, frame.bottom, (y, side) =>
    insideAt(frame, y, side)
  );
  const clear = tint(sketch, MATERIAL.porcelainDeep, 0);
  const across = (context: CanvasRenderingContext2D) =>
    context.createLinearGradient(frame.left, 0, frame.right, 0);
  painted(
    sketch,
    MATERIAL.porcelain,
    (context) =>
      stopped(context.createLinearGradient(0, frame.rim, 0, frame.base), [
        [0, MATERIAL.porcelain],
        [0.6, MATERIAL.porcelain],
        [0.86, MATERIAL.porcelainShade],
        [1, MATERIAL.porcelainDeep],
      ]),
    () => shape(sketch, shell)
  );
  painted(
    sketch,
    clear,
    (context) =>
      stopped(across(context), [
        [0, tint(sketch, MATERIAL.porcelainGloss, 230)],
        [0.05, tint(sketch, MATERIAL.porcelainGloss, 0)],
        [0.8, clear],
        [1, tint(sketch, MATERIAL.porcelainDeep, 110)],
      ]),
    () => shape(sketch, shell)
  );
  painted(
    sketch,
    MATERIAL.porcelain,
    (context) =>
      stopped(context.createLinearGradient(0, frame.top, 0, frame.bottom), [
        [0, MATERIAL.porcelainShade],
        [0.1, MATERIAL.porcelain],
        [0.55, MATERIAL.porcelain],
        [0.9, MATERIAL.porcelainShade],
        [1, MATERIAL.porcelainDeep],
      ]),
    () => shape(sketch, inside)
  );
  painted(
    sketch,
    clear,
    (context) =>
      stopped(across(context), [
        [0, tint(sketch, MATERIAL.porcelainDeep, 130)],
        [0.14, clear],
        [0.22, tint(sketch, MATERIAL.porcelainGloss, 0)],
        [0.29, tint(sketch, MATERIAL.porcelainGloss, 110)],
        [0.38, tint(sketch, MATERIAL.porcelainGloss, 0)],
        [0.86, clear],
        [1, tint(sketch, MATERIAL.porcelainDeep, 120)],
      ]),
    () => shape(sketch, inside)
  );
  sketch.push();
  sketch.noFill();
  sketch.strokeWeight(Math.max(0.8, frame.unit));
  sketch.stroke(tint(sketch, MATERIAL.porcelainDeep, 120));
  trace(sketch, inside);
  sketch.stroke(tint(sketch, MATERIAL.porcelainDeep, 90));
  trace(sketch, shell);
  sketch.pop();
}

/** The chrome plug in the floor: open while the tub drains, its stopper in while the tap is shut. */
function drawPlug(sketch: p5, frame: Frame, record: boolean) {
  const wide = frame.width * 0.015;
  const deep = frame.height * 0.004;
  const ring = (context: CanvasRenderingContext2D) =>
    chromeAcross(sketch, context, frame.plug - wide, frame.plug + wide);
  painted(sketch, MATERIAL.chrome, ring, () =>
    sketch.ellipse(frame.plug, frame.bottom - deep, wide * 2, deep * 2.4)
  );
  if (record) {
    painted(sketch, MATERIAL.chrome, ring, () =>
      sketch.arc(
        frame.plug,
        frame.bottom - deep * 1.6,
        wide * 1.4,
        deep * 5,
        Math.PI,
        Math.PI * 2
      )
    );
    return;
  }
  sketch.push();
  sketch.noStroke();
  sketch.fill(MATERIAL.chromeShadow);
  sketch.ellipse(frame.plug, frame.bottom - deep, wide, deep * 1.2);
  sketch.pop();
}

/**
 * The bathwater: clear and pale near the surface and deepening to teal with
 * depth, the glaze showing through it, and light rippling across the floor.
 */
function drawWater(sketch: p5, frame: Frame, surface: number, time: number) {
  if (surface >= frame.bottom - 1) {
    return;
  }
  const water = waterOf(frame, surface);
  const depth = frame.bottom - frame.top;
  painted(
    sketch,
    tint(sketch, MATERIAL.seawater, 190),
    (context) =>
      stopped(context.createLinearGradient(0, surface, 0, surface + depth), [
        [0, tint(sketch, MATERIAL.bathwater, 140)],
        [0.22, tint(sketch, MATERIAL.seawater, 150)],
        [1, tint(sketch, MATERIAL.seawaterDeep, 230)],
      ]),
    () => shape(sketch, water)
  );
  sketch.push();
  clipTo(sketch, water);
  sketch.noFill();
  sketch.strokeWeight(frame.unit);
  const span = frame.right - frame.left;
  // Caustics: short broken threads of light the rippling surface focuses
  // onto the glaze, brightest near the floor and drifting as it moves.
  Arr.forEach(Arr.range(0, 17), (thread) => {
    const start = frame.left + span * hashUnit(thread, 21);
    const reach = span * (0.08 + hashUnit(thread, 22) * 0.14);
    const y =
      frame.bottom -
      (frame.bottom - surface) * (0.03 + hashUnit(thread, 23) * 0.4);
    sketch.stroke(
      tint(sketch, MATERIAL.waterGlint, 20 + hashUnit(thread, 24) * 34)
    );
    trace(
      sketch,
      Arr.map(Arr.range(0, 10), (step): Point => {
        const x = start + (reach * step) / 10;
        return [
          x,
          y +
            Math.sin(x * 0.06 + time * 1.3 + thread) * 2.4 * frame.unit +
            Math.sin(x * 0.17 - time * 1.9 + thread * 0.7) * 1.1 * frame.unit,
        ];
      })
    );
  });
  sketch.pop();
  drawSurface(sketch, frame, surface, time);
}

/**
 * The surface seen from a little above: a light band with rings spreading
 * from where the stream lands, glints, a rippling front edge and the meniscus
 * along the back wall.
 */
function drawSurface(sketch: p5, frame: Frame, surface: number, time: number) {
  const band = Math.max(3, frame.height * 0.018);
  const back = surface - band / 2;
  const front = surface + band / 2;
  const across = (y: number) =>
    Arr.map(Arr.range(0, 36), (step) => {
      const from = insideAt(frame, y, "left");
      return from + ((insideAt(frame, y, "right") - from) * step) / 36;
    });
  const backEdge = Arr.map(across(back), (x): Point => [x, back]);
  const frontEdge = Arr.map(
    across(front),
    (x): Point => [
      x,
      front +
        Math.sin(x * 0.07 + time * 2.6) * 0.8 * frame.unit +
        Math.sin(x * 0.19 - time * 3.8) * 0.4 * frame.unit,
    ]
  );
  const sheet = Arr.appendAll(backEdge, Arr.reverse(frontEdge));
  painted(
    sketch,
    tint(sketch, MATERIAL.bathwater, 200),
    (context) =>
      stopped(context.createLinearGradient(0, back, 0, front), [
        [0, tint(sketch, MATERIAL.waterGlint, 220)],
        [0.5, tint(sketch, MATERIAL.bathwater, 210)],
        [1, tint(sketch, MATERIAL.seawater, 140)],
      ]),
    () => shape(sketch, sheet)
  );
  sketch.push();
  clipTo(sketch, sheet);
  sketch.noFill();
  sketch.strokeWeight(Math.max(0.8, frame.unit));
  Arr.forEach(Arr.range(0, 2), (ring) => {
    const phase = (time * 0.6 + ring / 3) % 1;
    sketch.stroke(tint(sketch, MATERIAL.waterGlint, (1 - phase) * 170));
    sketch.ellipse(
      frame.spout,
      surface,
      frame.width * (0.03 + phase * 0.3),
      band * (0.3 + phase * 0.9)
    );
  });
  sketch.noStroke();
  Arr.forEach(Arr.range(0, 5), (glint) => {
    const shine = 0.5 + 0.5 * Math.sin(time * 2 + glint * 2.3);
    sketch.fill(tint(sketch, MATERIAL.porcelainGloss, shine * 230));
    sketch.ellipse(
      frame.left +
        (frame.right - frame.left) * (0.15 + hashUnit(glint, 5) * 0.7),
      surface - band * 0.1,
      6 * frame.unit,
      frame.unit * 1.2
    );
  });
  sketch.pop();
  sketch.push();
  sketch.noFill();
  sketch.stroke(tint(sketch, MATERIAL.waterGlint, 230));
  sketch.strokeWeight(1.2 * frame.unit);
  trace(sketch, frontEdge);
  sketch.stroke(tint(sketch, MATERIAL.porcelainGloss, 160));
  sketch.strokeWeight(frame.unit);
  trace(sketch, backEdge);
  sketch.pop();
}

/** The CO2 level before industry, dashed across the tub, light over dark so it reads on glaze and water alike. */
function drawMark(sketch: p5, frame: Frame) {
  const y = markOf(frame);
  const from = insideAt(frame, y, "left") + 2;
  const to = insideAt(frame, y, "right") - 2;
  const dash = 6 * frame.unit;
  const dashes = Arr.range(0, Math.floor((to - from) / (dash * 1.7)));
  const strokes = [
    [2.6, tint(sketch, MATERIAL.seawaterDeep, 150)],
    [1.2, tint(sketch, MATERIAL.waterGlint, 235)],
  ] as const;
  sketch.push();
  sketch.strokeCap(sketch.ROUND);
  Arr.forEach(strokes, ([weight, colour]) => {
    sketch.stroke(colour);
    sketch.strokeWeight(weight * frame.unit);
    Arr.forEach(dashes, (each) => {
      const start = from + each * dash * 1.7;
      sketch.line(start, y, start + dash, y);
    });
  });
  sketch.pop();
}

/** The rolled rim along the back wall: a lit roll with a specular streak, casting a soft shadow into the bowl. */
function drawRim(sketch: p5, frame: Frame) {
  const over = frame.width * 0.007;
  const from = frame.left - over;
  const to = frame.right + over;
  const tall = frame.top - frame.rim;
  const clear = tint(sketch, MATERIAL.porcelainDeep, 0);
  const inner = insideAt(frame, frame.top, "left");
  painted(
    sketch,
    clear,
    (context) =>
      stopped(
        context.createLinearGradient(0, frame.top, 0, frame.top + tall * 1.4),
        [
          [0, tint(sketch, MATERIAL.porcelainDeep, 100)],
          [1, clear],
        ]
      ),
    () =>
      sketch.rect(
        inner,
        frame.top,
        insideAt(frame, frame.top, "right") - inner,
        tall * 1.4
      )
  );
  const roll = () => sketch.rect(from, frame.rim, to - from, tall, tall / 2);
  painted(
    sketch,
    MATERIAL.porcelain,
    (context) =>
      stopped(context.createLinearGradient(0, frame.rim, 0, frame.top), [
        [0, MATERIAL.porcelainShade],
        [0.24, MATERIAL.porcelainGloss],
        [0.45, MATERIAL.porcelain],
        [0.78, MATERIAL.porcelainShade],
        [1, MATERIAL.porcelainDeep],
      ]),
    roll
  );
  painted(
    sketch,
    clear,
    (context) =>
      stopped(context.createLinearGradient(from, 0, to, 0), [
        [0, tint(sketch, MATERIAL.porcelainGloss, 160)],
        [0.03, clear],
        [0.95, clear],
        [1, tint(sketch, MATERIAL.porcelainDeep, 130)],
      ]),
    roll
  );
  sketch.push();
  sketch.strokeCap(sketch.ROUND);
  sketch.stroke(MATERIAL.porcelainGloss);
  sketch.strokeWeight(Math.max(1, tall * 0.14));
  sketch.line(
    from + tall,
    frame.rim + tall * 0.26,
    to - tall * 3,
    frame.rim + tall * 0.26
  );
  sketch.pop();
}
