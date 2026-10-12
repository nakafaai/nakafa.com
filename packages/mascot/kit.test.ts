import { describe, expect, it } from "@effect/vitest";
import {
  blob,
  both,
  type Eyes,
  ellipse,
  eye,
  eyes,
  faded,
  figure,
  INK,
  kindAt,
  pointEars,
  roundEars,
  spikes,
} from "@repo/mascot/kit";
import { Array as Arr } from "effect";

/** A kit with the given eyes, looking `look` units to the side. */
function kitWith(open: typeof Eyes.Type, look = 0) {
  return {
    body: "#ee8a4c",
    eyes: open,
    ink: INK,
    look,
    second: "#f4e6ce",
  };
}

describe("mascot/kit", () => {
  it("rounds ellipse geometry to a tenth and turns a turned one about its own centre", () => {
    const flat = ellipse(100, 98.04, 60, 51.96, "#ee8a4c");
    expect(flat).toEqual({
      _tag: "Ellipse",
      cx: 100,
      cy: 98,
      fill: "#ee8a4c",
      rx: 60,
      ry: 52,
    });
    expect(flat).not.toHaveProperty("transform");

    expect(ellipse(10.04, 20.06, 5, 4, "#15294f", 22)).toEqual({
      _tag: "Ellipse",
      cx: 10,
      cy: 20.1,
      fill: "#15294f",
      rx: 5,
      ry: 4,
      transform: "rotate(22 10 20.1)",
    });
  });

  it("refuses a coordinate that is not a finite number", () => {
    expect(() => ellipse(Number.NaN, 0, 1, 1, INK)).toThrow();
    expect(() => ellipse(0, Number.POSITIVE_INFINITY, 1, 1, INK)).toThrow();
  });

  it("pairs flat coordinates into polygon points, each rounded to a tenth", () => {
    expect(blob([95, 106.04, 105.26, 106, 100, 110.96], INK, 3)).toEqual({
      _tag: "Polygon",
      fill: INK,
      points: "95,106 105.3,106 100,111",
      rounding: 3,
    });
  });

  it("draws a layer on the left side first and then on the right", () => {
    const sides = both((side) => ellipse(100 + side * 10, 50, 5, 5, INK));
    expect(Arr.map(sides, ({ cx }) => cx)).toEqual([90, 110]);
  });

  it("lays single layers and groups of layers flat, in order", () => {
    const first = ellipse(1, 1, 1, 1, INK);
    const second = ellipse(2, 2, 1, 1, INK);
    const third = ellipse(3, 3, 1, 1, INK);
    const fourth = ellipse(4, 4, 1, 1, INK);
    expect(figure(first, [second, third], [], fourth)).toEqual([
      first,
      second,
      third,
      fourth,
    ]);
  });

  it("keeps shapes that are drawn together at one opacity in one layer", () => {
    const dot = ellipse(1, 1, 1, 1, INK);
    expect(faded(0.3, [dot, dot])).toEqual({
      _tag: "Fade",
      opacity: 0.3,
      shapes: [dot, dot],
    });
  });

  describe("eyes", () => {
    it("marks an open eye, and draws a smiling or sleeping eye as a line", () => {
      expect(eye("titik", 74, 94, 6.4, INK)).toEqual({
        _tag: "Eye",
        cx: 74,
        cy: 94,
        fill: INK,
        rx: 6.4,
        ry: 7.8,
      });
      expect(eye("kedip", 74, 94, 6.4, INK)).toHaveProperty("_tag", "Eye");
      expect(eye("senyum", 74, 94, 6.4, INK)).toEqual({
        _tag: "Line",
        color: INK,
        d: "M67.6,96 Q74,85.6 80.4,96",
        width: 4.6,
      });
      expect(eye("tidur", 74, 94, 6.4, INK)).toEqual({
        _tag: "Line",
        color: INK,
        d: "M67.6,93 Q74,100.4 80.4,93",
        width: 4.6,
      });
    });

    it("winks with the left eye only", () => {
      expect(kindAt("kedip", -1)).toBe("senyum");
      expect(kindAt("kedip", 1)).toBe("titik");
      expect(kindAt("tidur", -1)).toBe("tidur");
      expect(kindAt("tidur", 1)).toBe("tidur");
      expect(kindAt("titik", -1)).toBe("titik");
    });

    it("draws two open eyes that the pose shifts to the side", () => {
      const pair = eyes(kitWith("titik", 2.6), 26, 94);
      expect(Arr.map(pair, (shape) => shape._tag)).toEqual(["Eye", "Eye"]);
      expect(Arr.map(pair, (shape) => ("cx" in shape ? shape.cx : 0))).toEqual([
        76.6, 128.6,
      ]);
    });

    it("closes both eyes when they smile or sleep, and one when they wink", () => {
      const tags = (open: typeof Eyes.Type) =>
        Arr.map(eyes(kitWith(open), 26, 94), (shape) => shape._tag);
      expect(tags("senyum")).toEqual(["Line", "Line"]);
      expect(tags("tidur")).toEqual(["Line", "Line"]);
      expect(tags("kedip")).toEqual(["Line", "Eye"]);
    });

    it("takes its size and its ink from the animal when asked", () => {
      const [left] = eyes(kitWith("titik"), 26, 96, 5, "#f6f4ef");
      expect(left).toMatchObject({ fill: "#f6f4ef", rx: 5 });
    });
  });

  describe("ears and spikes", () => {
    it("gives round ears an inner ear only when it has a colour", () => {
      expect(roundEars("#c89468", null, 46, 52, 19)).toHaveLength(2);
      const lined = roundEars("#c89468", "#f4e6ce", 46, 52, 19);
      expect(
        Arr.map(lined, (shape) => ("fill" in shape ? shape.fill : ""))
      ).toEqual(["#c89468", "#f4e6ce", "#c89468", "#f4e6ce"]);
    });

    it("draws pointed ears as an outer and an inner ear on each side", () => {
      const ears = pointEars("#ee8a4c", INK);
      expect(Arr.map(ears, (shape) => shape._tag)).toEqual([
        "Polygon",
        "Polygon",
        "Polygon",
        "Polygon",
      ]);
      expect(ears[0]).toMatchObject({ fill: "#ee8a4c", rounding: 12 });
      expect(ears[1]).toMatchObject({ fill: INK, rounding: 5 });
    });

    it("draws one rounded triangle per spike, 4 wide unless told otherwise", () => {
      const ring = spikes(100, 108, 54, 80, 188, 352, 11, "#b98a63");
      expect(ring).toHaveLength(11);
      expect(Arr.every(ring, (spike) => spike.rounding === 4)).toBe(true);
      expect(
        spikes(100, 108, 54, 80, 188, 352, 3, "#b98a63", 6)[0]
      ).toHaveProperty("rounding", 6);
    });
  });
});
