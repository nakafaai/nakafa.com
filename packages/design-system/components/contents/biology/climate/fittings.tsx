import type {
  Frame,
  Point,
} from "@repo/design-system/components/contents/biology/climate/frame";
import {
  chromeAcross,
  chromeBlock,
  chromeMid,
  drawPipe,
  painted,
  shadowAt,
  shape,
  stopped,
} from "@repo/design-system/components/contents/biology/climate/paint";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { ECOLOGY_COLORS } from "@repo/design-system/lib/material/ecology";
import { Array as Arr } from "effect";
import type p5 from "p5";

/** The tub's soft shadow on the floor and, while it drains, the floor grate the waste spills into. */
export function drawFloor(sketch: p5, frame: Frame, draining: boolean) {
  const middle = (frame.left + frame.right) / 2;
  const span = frame.right - frame.left;
  shadowAt(
    sketch,
    [middle, frame.ground],
    span * 0.62,
    frame.height * 0.05,
    70
  );
  if (!draining) {
    return;
  }
  const [x] = frame.outlet;
  const wide = frame.width * 0.02;
  const deep = frame.height * 0.007;
  painted(
    sketch,
    CAR_COLORS.chrome,
    (context) => chromeAcross(sketch, context, x - wide, x + wide),
    () => sketch.ellipse(x, frame.ground, wide * 2, deep * 2)
  );
  sketch.push();
  sketch.noStroke();
  sketch.fill(ECOLOGY_COLORS.chromeShadow);
  sketch.ellipse(x, frame.ground, wide * 1.5, deep * 1.2);
  sketch.stroke(chromeMid(sketch, 0.8));
  sketch.strokeWeight(Math.max(0.8, frame.unit));
  Arr.forEach([-0.4, 0, 0.4], (slat) =>
    sketch.line(
      x + slat * wide,
      frame.ground - deep * 0.55,
      x + slat * wide,
      frame.ground + deep * 0.55
    )
  );
  sketch.pop();
}

/** A quarter of a bend of radius `bend` around `centre`, from angle `from` turning by `turn`. */
function bendAt([x, y]: Point, bend: number, from: number, turn: number) {
  return Arr.map(Arr.range(0, 8), (step): Point => {
    const angle = from + (turn * step) / 8;
    return [x + bend * Math.cos(angle), y + bend * Math.sin(angle)];
  });
}

/** The exposed chrome waste: down from the plug, a bend toward the middle of the tub, and an open end over the floor grate. */
export function drawWaste(sketch: p5, frame: Frame) {
  const { bend, drop, plug } = frame;
  const [end, mouth] = frame.outlet;
  const thickness = frame.width * 0.011;
  const start: Point = [plug, frame.bottom];
  const finish: Point = [end, mouth];
  drawPipe(
    sketch,
    Arr.flatten([
      [start],
      bendAt([plug - bend, drop], bend, 0, Math.PI / 2),
      bendAt([end + bend, drop + bend * 2], bend, -Math.PI / 2, -Math.PI / 2),
      [finish],
    ]),
    thickness
  );
  chromeBlock(
    sketch,
    end - thickness * 0.75,
    mouth - thickness * 0.9,
    thickness * 1.5,
    thickness * 0.9
  );
}

/** A turned chrome foot under the tub at `x`, ending in a ball on the floor. */
export function drawFoot(sketch: p5, frame: Frame, x: number) {
  const top = frame.base - frame.height * 0.015;
  const half = frame.width * 0.017;
  const ball = frame.width * 0.012;
  const neck = frame.width * 0.007;
  const ballY = frame.ground - ball;
  shadowAt(sketch, [x, frame.ground], half * 1.6, frame.height * 0.012, 120);
  painted(
    sketch,
    CAR_COLORS.chrome,
    (context) => chromeAcross(sketch, context, x - half, x + half),
    () =>
      shape(sketch, [
        [x - half, top],
        [x + half, top],
        [x + half * 0.8, top + (ballY - top) * 0.3],
        [x + neck, ballY - ball * 0.6],
        [x - neck, ballY - ball * 0.6],
        [x - half * 0.8, top + (ballY - top) * 0.3],
      ])
  );
  painted(
    sketch,
    CAR_COLORS.chrome,
    (context) =>
      stopped(
        context.createRadialGradient(
          x - ball * 0.4,
          ballY - ball * 0.45,
          ball * 0.05,
          x,
          ballY,
          ball
        ),
        [
          [0, ECOLOGY_COLORS.chromeSpecular],
          [0.3, CAR_COLORS.chrome],
          [0.75, chromeMid(sketch, 0.45)],
          [1, ECOLOGY_COLORS.chromeShadow],
        ]
      ),
    () => sketch.circle(x, ballY, ball * 2)
  );
}

/** The floor-standing gooseneck filler: a flanged base, a mixer with its lever, the column, the arch and the aerator. */
export function drawFiller(sketch: p5, frame: Frame) {
  const thick = frame.width * 0.013;
  const flange = frame.height * 0.02;
  const arch = frame.height * 0.1;
  const rise = frame.height * 0.06;
  const half = (frame.spout - frame.column) / 2;
  const collar = frame.height * 0.022;
  const mixer = frame.ground - (frame.ground - arch) * 0.42;
  shadowAt(
    sketch,
    [frame.column, frame.ground],
    thick * 2.4,
    frame.height * 0.012,
    120
  );
  const foot: Point = [frame.column, frame.ground - flange];
  const mouth: Point = [frame.spout, frame.nozzle - collar];
  drawPipe(
    sketch,
    Arr.flatten([
      [foot],
      Arr.map(Arr.range(0, 18), (step): Point => {
        const angle = Math.PI - (Math.PI * step) / 18;
        return [
          frame.column + half + half * Math.cos(angle),
          arch - rise * Math.sin(angle),
        ];
      }),
      [mouth],
    ]),
    thick
  );
  drawPipe(
    sketch,
    [
      [frame.column, mixer],
      [frame.column - frame.width * 0.019, mixer - frame.height * 0.016],
    ],
    thick * 0.5
  );
  chromeBlock(
    sketch,
    frame.column - thick * 0.78,
    mixer - frame.height * 0.035,
    thick * 1.56,
    frame.height * 0.05
  );
  chromeBlock(
    sketch,
    frame.spout - thick * 0.62,
    frame.nozzle - collar,
    thick * 1.24,
    collar
  );
  painted(
    sketch,
    CAR_COLORS.chrome,
    (context) =>
      chromeAcross(
        sketch,
        context,
        frame.column - thick * 1.3,
        frame.column + thick * 1.3
      ),
    () =>
      shape(sketch, [
        [frame.column - thick * 0.75, frame.ground - flange],
        [frame.column + thick * 0.75, frame.ground - flange],
        [frame.column + thick * 1.3, frame.ground],
        [frame.column - thick * 1.3, frame.ground],
      ])
  );
}
