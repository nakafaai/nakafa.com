import { caption } from "@repo/design-system/components/contents/physics/canvas/caption";
import {
  fade,
  gradientRect,
  litBall,
  mix,
  spotlight,
  withShadow,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import type { Point } from "@repo/design-system/components/contents/physics/optics/light";
import { getColor } from "@repo/design-system/lib/color";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr } from "effect";
import type p5 from "p5";

/**
 * Painting for the electricity labs: a circuit laid out on a wooden board
 * under a desk lamp, with insulated wires, a dry cell, banded resistors,
 * glass bulbs whose filaments glow with their power, analog meters and a
 * heating coil.
 */

/** The wooden board under the circuit, lit from above. */
export function paintBoard(sketch: p5) {
  const { height, width } = sketch;
  gradientRect(sketch, { height, width, x: 0, y: 0 }, [
    [0, mix(MATERIAL.oak, getColor("WHITE"), 0.08)],
    [1, mix(MATERIAL.oak, getColor("BLACK"), 0.35)],
  ]);
  sketch.stroke(fade(mix(MATERIAL.oak, getColor("BLACK"), 0.5), 0.25));
  sketch.strokeWeight(1);
  for (let y = 6; y < height; y += 9) {
    sketch.line(
      0,
      y + Math.sin(y * 0.07) * 3,
      width,
      y + Math.cos(y * 0.05) * 3
    );
  }
  spotlight(sketch, { x: width * 0.45, y: height * 0.3 }, width * 0.7, {
    color: MATERIAL.lampLight,
    strength: 0.2,
  });
}

/** An insulated wire along `points`, its colour `color`, with a lit edge. */
export function wire(sketch: p5, points: readonly Point[], color: string) {
  const pairs = Arr.zip(points, Arr.drop(points, 1));
  sketch.push();
  sketch.strokeCap(sketch.ROUND);
  sketch.strokeJoin(sketch.ROUND);
  for (const [weight, shade] of [
    [6, mix(color, getColor("BLACK"), 0.45)],
    [4, color],
    [1.2, mix(color, getColor("WHITE"), 0.45)],
  ] as const) {
    sketch.stroke(shade);
    sketch.strokeWeight(weight);
    for (const [from, to] of pairs) {
      sketch.line(from.x, from.y, to.x, to.y);
    }
  }
  sketch.pop();
}

/** A brass terminal post where wires meet. */
export function terminal(sketch: p5, at: Point) {
  litBall(sketch, at, 5, {
    dark: mix(MATERIAL.brass, getColor("BLACK"), 0.5),
    light: mix(MATERIAL.brass, getColor("WHITE"), 0.4),
  });
}

/**
 * A dry cell centred on `at`, `size` pixels long, lying across the board, or
 * standing up when `upright`, with its positive cap toward `facing`: right or
 * down for 1, left or up for -1.
 */
export function paintCell(
  sketch: p5,
  at: Point,
  size: number,
  facing: 1 | -1,
  upright = false
) {
  const thick = size * 0.36;
  sketch.push();
  sketch.translate(at.x, at.y);
  sketch.rotate(upright ? Math.PI / 2 : 0);
  withShadow(
    sketch,
    { blur: 10, color: fade(getColor("BLACK"), 0.5), drop: 4 },
    () => {
      gradientRect(
        sketch,
        { height: thick, width: size, x: -size / 2, y: -thick / 2 },
        [
          [0, mix(MATERIAL.battery, getColor("WHITE"), 0.3)],
          [0.45, MATERIAL.battery],
          [1, mix(MATERIAL.battery, getColor("BLACK"), 0.6)],
        ]
      );
    }
  );
  const cap = (facing * size) / 2;
  sketch.noStroke();
  sketch.fill(MATERIAL.batteryTerminal);
  sketch.rect(
    Math.min(cap, cap + facing * size * 0.06),
    -thick * 0.2,
    size * 0.06,
    thick * 0.4,
    2
  );
  sketch.fill(fade(MATERIAL.batteryTerminal, 0.9));
  sketch.rect(
    facing * size * 0.18 - size * 0.04,
    -thick / 2,
    size * 0.08,
    thick
  );
  sketch.pop();
}

/** The colour bands of a resistor, from the palette of resistor codes. */
const BAND_COLORS = [
  MATERIAL.hullRed,
  MATERIAL.signalAmber,
  MATERIAL.walnut,
  MATERIAL.brass,
] as const;

/** A banded resistor between `from` and `to`, with its leads. */
export function paintResistor(
  sketch: p5,
  from: Point,
  to: Point,
  size: number
) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  sketch.push();
  sketch.translate(from.x, from.y);
  sketch.rotate(angle);
  sketch.stroke(MATERIAL.probeSteel);
  sketch.strokeWeight(2);
  sketch.line(0, 0, length, 0);
  sketch.noStroke();
  const body = Math.min(size, length * 0.7);
  const left = (length - body) / 2;
  gradientRect(
    sketch,
    { height: body * 0.32, width: body, x: left, y: -body * 0.16 },
    [
      [0, mix(MATERIAL.cellBody, getColor("WHITE"), 0.35)],
      [0.5, MATERIAL.cellBody],
      [1, mix(MATERIAL.cellBody, getColor("BLACK"), 0.4)],
    ]
  );
  Arr.forEach(BAND_COLORS, (color, index) => {
    sketch.fill(color);
    sketch.rect(
      left + body * (0.18 + index * 0.17),
      -body * 0.16,
      body * 0.07,
      body * 0.32
    );
  });
  sketch.pop();
}

/** A glass bulb at `at` whose filament glows with `glow` from 0 (off) to 1 (full brightness); a broken one shows its snapped filament. */
export function paintBulb(
  sketch: p5,
  at: Point,
  size: number,
  glow: number,
  broken = false
) {
  if (glow > 0) {
    spotlight(sketch, at, size * (1.2 + 2.2 * glow), {
      color: MATERIAL.filamentGlow,
      strength: 0.75 * glow,
    });
  }
  sketch.noStroke();
  sketch.fill(
    fade(
      mix(MATERIAL.glass, MATERIAL.filamentGlow, glow * 0.6),
      0.35 + 0.4 * glow
    )
  );
  sketch.circle(at.x, at.y, size);
  sketch.fill(MATERIAL.aluminium);
  sketch.rect(
    at.x - size * 0.22,
    at.y + size * 0.4,
    size * 0.44,
    size * 0.3,
    2
  );
  sketch.noFill();
  sketch.stroke(
    glow > 0
      ? mix(MATERIAL.filamentGlow, getColor("WHITE"), glow * 0.7)
      : getColor("NEUTRAL", 700)
  );
  sketch.strokeWeight(glow > 0 ? 2 : 1.5);
  if (broken) {
    sketch.line(
      at.x - size * 0.2,
      at.y + size * 0.05,
      at.x - size * 0.05,
      at.y - size * 0.08
    );
    sketch.line(
      at.x + size * 0.2,
      at.y + size * 0.05,
      at.x + size * 0.08,
      at.y - size * 0.02
    );
  } else {
    sketch.arc(
      at.x,
      at.y + size * 0.05,
      size * 0.4,
      size * 0.3,
      Math.PI,
      Math.PI * 2
    );
  }
  sketch.stroke(fade(getColor("WHITE"), 0.6));
  sketch.strokeWeight(1.2);
  sketch.circle(at.x, at.y, size);
}

/** An analog meter at `at` with `letter` on its dial and its needle at `value` of `full` scale. */
export function paintMeter(
  sketch: p5,
  at: Point,
  size: number,
  reading: {
    readonly full: number;
    readonly letter: string;
    readonly value: number;
  }
) {
  withShadow(
    sketch,
    { blur: 10, color: fade(getColor("BLACK"), 0.5), drop: 4 },
    () => {
      sketch.noStroke();
      sketch.fill(MATERIAL.meterBody);
      sketch.rect(at.x - size / 2, at.y - size / 2, size, size, size * 0.12);
    }
  );
  sketch.fill(MATERIAL.dialFace);
  sketch.arc(
    at.x,
    at.y + size * 0.18,
    size * 0.82,
    size * 0.82,
    Math.PI,
    Math.PI * 2
  );
  sketch.stroke(getColor("NEUTRAL", 700));
  sketch.strokeWeight(1);
  for (let tick = 0; tick <= 10; tick += 1) {
    const angle = Math.PI + (tick / 10) * Math.PI;
    const outer = size * 0.39;
    const inner = tick % 5 === 0 ? size * 0.3 : size * 0.34;
    sketch.line(
      at.x + Math.cos(angle) * inner,
      at.y + size * 0.18 + Math.sin(angle) * inner,
      at.x + Math.cos(angle) * outer,
      at.y + size * 0.18 + Math.sin(angle) * outer
    );
  }
  const share = Math.min(Math.max(reading.value / reading.full, 0), 1);
  const needle = Math.PI + share * Math.PI;
  sketch.stroke(MATERIAL.dialNeedle);
  sketch.strokeWeight(2);
  sketch.line(
    at.x,
    at.y + size * 0.18,
    at.x + Math.cos(needle) * size * 0.36,
    at.y + size * 0.18 + Math.sin(needle) * size * 0.36
  );
  caption(
    sketch,
    reading.letter,
    { x: at.x, y: at.y + size * 0.3 },
    {
      align: "center",
      baseline: "middle",
      color: getColor("NEUTRAL", 800),
      size: size * 0.2,
    }
  );
}

/** A heating coil between `from` and `to` that glows from dull grey to orange-white with `glow` from 0 to 1. */
export function paintCoil(sketch: p5, from: Point, to: Point, glow: number) {
  const turns = 12;
  const amplitude = Math.hypot(to.x - from.x, to.y - from.y) * 0.08;
  const color =
    glow > 0
      ? mix(MATERIAL.coalGlow, MATERIAL.headlightGlow, glow * 0.6)
      : MATERIAL.galvanizedSteel;
  const step = (index: number) => {
    const t = index / (turns * 8);
    return {
      x: from.x + (to.x - from.x) * t,
      y:
        from.y +
        (to.y - from.y) * t +
        Math.sin(t * turns * Math.PI * 2) * amplitude,
    };
  };
  const points = Arr.makeBy(turns * 8 + 1, step);
  if (glow > 0) {
    spotlight(
      sketch,
      { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
      amplitude * 10,
      {
        color: MATERIAL.coalGlow,
        strength: 0.55 * glow,
      }
    );
  }
  sketch.push();
  sketch.noFill();
  sketch.stroke(color);
  sketch.strokeWeight(3);
  for (const [a, b] of Arr.zip(points, Arr.drop(points, 1))) {
    sketch.line(a.x, a.y, b.x, b.y);
  }
  sketch.pop();
}
