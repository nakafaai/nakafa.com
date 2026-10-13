import { describe, expect, it } from "@effect/vitest";
import { hitter, outlineOf } from "@repo/mascot/nina/test.hit";
import {
  circle,
  ellipse,
  group,
  path,
  polygon,
  rect,
  type Shape,
} from "@repo/mascot/shape";
import { Option } from "effect";

/** The shape on top at a place of a picture, if any. */
function topAt(shapes: readonly Shape[], x: number, y: number) {
  return Option.getOrUndefined(hitter(shapes)(x, y));
}

describe("the places along a path", () => {
  it("are the places it draws, in order: its moves and lines, then twelve along each curve, and the start again where it closes", () => {
    expect(outlineOf("M0,0 L10,0 H20 V5 Z")).toEqual([
      [0, 0],
      [10, 0],
      [20, 0],
      [20, 5],
      [0, 0],
    ]);
    const curve = outlineOf("M0,0 Q10,0 10,10");
    expect(curve).toHaveLength(13);
    expect(curve[0]).toEqual([0, 0]);
    expect(curve[12]).toEqual([10, 10]);
    expect(curve[6][0]).toBeCloseTo(7.5, 9);
    expect(curve[6][1]).toBeCloseTo(2.5, 9);
  });
});

describe("the shape on top at a place", () => {
  it("is found inside the outline of a filled path of lines", () => {
    const triangle = path({ d: "M0,0 L10,0 L10,10 Z", fill: "red" });
    expect(topAt([triangle], 8, 3)).toBe(triangle);
    expect(topAt([triangle], 3, 8)).toBeUndefined();
    expect(topAt([triangle], 12, 2)).toBeUndefined();
  });

  it("follows horizontal and vertical moves, and a second piece after a move", () => {
    const corner = path({
      d: "M0,0 H10 V10 Z M20,20 L24,20 L24,24 Z",
      fill: "red",
    });
    expect(topAt([corner], 8, 3)).toBe(corner);
    expect(topAt([corner], 3, 8)).toBeUndefined();
    expect(topAt([corner], 23, 21)).toBe(corner);
  });

  it("follows quadratic and cubic curves", () => {
    const bow = path({ d: "M0,0 Q10,0 10,10 Z", fill: "red" });
    const arch = path({ d: "M0,0 C0,10 10,10 10,0 Z", fill: "red" });
    expect(topAt([bow], 8, 6)).toBe(bow);
    expect(topAt([bow], 8, 2)).toBeUndefined();
    expect(topAt([arch], 5, 5)).toBe(arch);
    expect(topAt([arch], 5, 9)).toBeUndefined();
  });

  it("is a filled shape when the shape does not say otherwise, and not when it says none", () => {
    const plain = path({ d: "M0,0 L10,0 L10,10 Z" });
    const empty = path({ d: "M0,0 L10,0 L10,10 Z", fill: "none" });
    expect(topAt([plain], 8, 3)).toBe(plain);
    expect(topAt([empty], 8, 3)).toBeUndefined();
  });

  it("is a line within half its width, when the shape is stroked", () => {
    const line = path({
      d: "M0,0 L20,0",
      fill: "none",
      stroke: "black",
      strokeWidth: 4,
    });
    expect(topAt([line], 10, 1.9)).toBe(line);
    expect(topAt([line], 10, 2.1)).toBeUndefined();
    expect(topAt([line], 22.1, 0)).toBeUndefined();
  });

  it("counts a stroke of width one when no width is given, and none when the stroke is none", () => {
    const thin = path({ d: "M0,0 L20,0", fill: "none", stroke: "black" });
    const none = path({ d: "M0,0 L20,0", fill: "none", stroke: "none" });
    expect(topAt([thin], 10, 0.4)).toBe(thin);
    expect(topAt([thin], 10, 0.6)).toBeUndefined();
    expect(topAt([none], 10, 0)).toBeUndefined();
  });

  it("is found in a polygon, by its fill and by its stroke", () => {
    const filled = polygon({ fill: "red", points: "0,0 10,0 10,10" });
    const outlined = polygon({
      fill: "none",
      points: "0,0 10,0 10,10",
      stroke: "black",
      strokeWidth: 2,
    });
    expect(topAt([filled], 8, 3)).toBe(filled);
    expect(topAt([filled], 3, 8)).toBeUndefined();
    expect(topAt([outlined], 8, 3)).toBeUndefined();
    expect(topAt([outlined], 5, 5.5)).toBe(outlined);
  });

  it("is found in a rectangle, round at its corners when it has a radius", () => {
    const sharp = rect({ fill: "red", height: 10, width: 20, x: 5, y: 5 });
    const round = rect({ fill: "red", height: 10, rx: 4, width: 20 });
    const empty = rect({ fill: "none", height: 10, width: 20 });
    expect(topAt([sharp], 6, 6)).toBe(sharp);
    expect(topAt([sharp], 4, 6)).toBeUndefined();
    expect(topAt([round], 10, 5)).toBe(round);
    expect(topAt([round], 0.3, 0.3)).toBeUndefined();
    expect(topAt([round], 20.5, 5)).toBeUndefined();
    expect(topAt([empty], 10, 5)).toBeUndefined();
  });

  it("is found in a circle and an ellipse, and in the ring of a stroked circle", () => {
    const disc = circle({ cx: 10, cy: 10, fill: "red", r: 5 });
    const lens = circle({
      cx: 10,
      cy: 10,
      fill: "red",
      r: 5,
      stroke: "black",
      strokeWidth: 4,
    });
    const ring = circle({
      cx: 10,
      cy: 10,
      fill: "none",
      r: 5,
      stroke: "black",
      strokeWidth: 4,
    });
    const oval = ellipse({ cx: 10, cy: 10, fill: "red", rx: 8, ry: 4 });
    const hollow = ellipse({ cx: 10, cy: 10, fill: "none", rx: 8, ry: 4 });
    expect(topAt([disc], 13, 10)).toBe(disc);
    expect(topAt([disc], 16, 10)).toBeUndefined();
    expect(topAt([lens], 16.9, 10)).toBe(lens);
    expect(topAt([lens], 17.1, 10)).toBeUndefined();
    expect(topAt([ring], 16.9, 10)).toBe(ring);
    expect(topAt([ring], 10, 10)).toBeUndefined();
    expect(topAt([ring], 17.1, 10)).toBeUndefined();
    expect(topAt([oval], 17, 10)).toBe(oval);
    expect(topAt([oval], 10, 15)).toBeUndefined();
    expect(topAt([hollow], 10, 10)).toBeUndefined();
  });

  it("is the shape that is drawn last, whatever the group it lies in", () => {
    const below = rect({ fill: "red", height: 10, width: 10 });
    const above = rect({ fill: "blue", height: 10, width: 10 });
    const inside = group([above]);
    expect(topAt([below, above], 5, 5)).toBe(above);
    expect(topAt([above, below], 5, 5)).toBe(below);
    expect(topAt([below, inside], 5, 5)).toBe(above);
    expect(topAt([inside, below], 5, 5)).toBe(below);
  });

  it("is looked for through the transforms of the groups, the outermost first", () => {
    const box = rect({ fill: "red", height: 10, width: 10 });
    const moved = group([box], { transform: "translate(30 20)" });
    const doubled = group([box], { transform: "scale(2)" });
    const stretched = group([box], { transform: "scale(-1 3)" });
    const turned = group([box], { transform: "rotate(90 0 0)" });
    const nested = group([group([box], { transform: "scale(2)" })], {
      transform: "translate(30 20)",
    });
    const chained = group([box], { transform: "translate(30 20) scale(2)" });
    expect(topAt([moved], 35, 25)).toBe(box);
    expect(topAt([moved], 5, 5)).toBeUndefined();
    expect(topAt([doubled], 15, 15)).toBe(box);
    expect(topAt([doubled], 25, 5)).toBeUndefined();
    expect(topAt([stretched], -5, 15)).toBe(box);
    expect(topAt([stretched], 5, 15)).toBeUndefined();
    expect(topAt([turned], -5, 5)).toBe(box);
    expect(topAt([turned], 5, 5)).toBeUndefined();
    expect(topAt([nested], 45, 35)).toBe(box);
    expect(topAt([chained], 45, 35)).toBe(box);
    expect(topAt([chained], 35, 25)).toBe(box);
  });

  it("takes the numbers that a transform leaves out as zero, or as the first number for a scale", () => {
    const box = rect({ fill: "red", height: 10, width: 10 });
    const slid = group([box], { transform: "translate(30)" });
    const turned = group([box], { transform: "rotate(90)" });
    expect(topAt([slid], 35, 5)).toBe(box);
    expect(topAt([slid], 35, 15)).toBeUndefined();
    expect(topAt([turned], -5, 5)).toBe(box);
    expect(topAt([turned], 5, 5)).toBeUndefined();
  });

  it("is turned about a place of its own, and a shape may carry a transform too", () => {
    const bar = rect({
      fill: "red",
      height: 4,
      transform: "rotate(90 10 10)",
      width: 20,
      x: 0,
      y: 8,
    });
    expect(topAt([bar], 10, 2)).toBe(bar);
    expect(topAt([bar], 2, 10)).toBeUndefined();
  });

  it("is nothing where nothing is drawn", () => {
    expect(topAt([], 0, 0)).toBeUndefined();
  });
});
