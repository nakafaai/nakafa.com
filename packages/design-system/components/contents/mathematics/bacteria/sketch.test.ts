import { describe, expect, it } from "@effect/vitest";
import {
  type BacteriaFrame,
  bacteriaProgram,
} from "@repo/design-system/components/contents/mathematics/bacteria/sketch";
import type p5 from "p5";

/** A stand-in for a p5 instance that records the circles each frame draws. */
function stage(looping: boolean) {
  const circles: number[][] = [];
  const calls = { advance: 0, canvas: 0 };
  const sketch = {
    circle: (x: number, y: number, size: number) => circles.push([x, y, size]),
    clear: () => circles.splice(0),
    createCanvas: () => {
      calls.canvas += 1;
    },
    deltaTime: 250,
    draw: () => undefined,
    fill: () => undefined,
    height: 200,
    isLooping: () => looping,
    noStroke: () => undefined,
    setup: () => undefined,
    width: 400,
  };
  return { calls, circles, sketch };
}

const frame = (overrides: Partial<BacteriaFrame> = {}): BacteriaFrame => ({
  advance: () => undefined,
  color: "#0d9488",
  current: 2,
  generation: 1,
  interval: 1000,
  maxGenerations: 3,
  next: 4,
  ...overrides,
});

describe("bacteria sketch", () => {
  it("divides over one interval and then asks for the next generation", () => {
    const { calls, circles, sketch } = stage(true);
    let advanced = 0;
    const read = () =>
      frame({
        advance: () => {
          advanced += 1;
        },
      });
    bacteriaProgram(sketch as unknown as p5, read);
    sketch.setup();
    for (let tick = 0; tick < 4; tick += 1) {
      sketch.draw();
    }

    expect(calls.canvas).toBe(1);
    expect(advanced).toBe(1);
    expect(circles).toHaveLength(4);
  });

  it("holds a paused generation and starts a newly chosen one from its growth", () => {
    const { circles, sketch } = stage(false);
    let current = frame();
    bacteriaProgram(sketch as unknown as p5, () => current);
    sketch.draw();
    expect(circles).toHaveLength(2);

    current = frame({ current: 4, generation: 2, next: 8 });
    sketch.draw();
    expect(circles).toHaveLength(4);
  });

  it("stops at the last generation", () => {
    const { sketch } = stage(true);
    let advanced = 0;
    bacteriaProgram(sketch as unknown as p5, () =>
      frame({
        advance: () => {
          advanced += 1;
        },
        generation: 3,
        maxGenerations: 3,
        next: 2,
      })
    );
    for (let tick = 0; tick < 8; tick += 1) {
      sketch.draw();
    }
    expect(advanced).toBe(0);
  });
});
