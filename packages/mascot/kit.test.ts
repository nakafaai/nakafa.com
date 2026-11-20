import { describe, expect, it } from "@effect/vitest";
import type { Eyes } from "@repo/mascot/kit";
import {
  blob,
  both,
  ellipse,
  eye,
  eyes,
  figure,
  grin,
  INK,
  kindAt,
  Mark,
  mew,
  nose,
  pointEars,
  roundEars,
  smile,
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
      _tag: "ellipse",
      cx: 100,
      cy: 98,
      fill: "#ee8a4c",
      rx: 60,
      ry: 52,
    });
    expect(flat).not.toHaveProperty("transform");

    expect(ellipse(10.04, 20.06, 5, 4, "#15294f", 22)).toEqual({
      _tag: "ellipse",
      cx: 10,
      cy: 20.1,
      fill: "#15294f",
      rx: 5,
      ry: 4,
      transform: "rotate(22 10 20.1)",
    });
  });

  it("pairs flat coordinates into polygon points, each rounded to a tenth, and rounds its corners with a stroke of its own fill", () => {
    expect(blob([95, 106.04, 105.26, 106, 100, 110.96], INK, 3)).toEqual({
      _tag: "polygon",
      fill: INK,
      points: "95,106 105.3,106 100,111",
      stroke: INK,
      strokeLinejoin: "round",
      strokeWidth: 3,
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

  describe("eyes", () => {
    it("marks an open eye, a plain dot of ink, and draws a smiling or sleeping eye as a line", () => {
      // An open eye is its pupil alone, marked, so it follows the pointer and
      // stays a clean dot at the smallest avatar.
      expect(eye("open", 74, 94, 7, INK)).toEqual({
        _tag: "g",
        children: [
          { _tag: "ellipse", cx: 74, cy: 94, fill: INK, rx: 7, ry: 8.4 },
        ],
        mark: Mark.literal,
      });
      expect(eye("wink", 74, 94, 7, INK)).toHaveProperty("mark", "eye");
      expect(eye("smile", 74, 94, 7, INK)).toEqual({
        _tag: "path",
        d: "M67,96.8 Q74,85.6 81,96.8",
        fill: "none",
        stroke: INK,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: 4.3,
      });
      expect(eye("asleep", 74, 94, 7, INK)).toEqual({
        _tag: "path",
        d: "M67,92.6 Q74,101.7 81,92.6",
        fill: "none",
        stroke: INK,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: 4.3,
      });
    });

    it("keeps the line of a small closed eye thick enough to read", () => {
      expect(eye("smile", 74, 94, 4, INK)).toHaveProperty("strokeWidth", 3.4);
    });

    it("winks with the left eye only", () => {
      expect(kindAt("wink", -1)).toBe("smile");
      expect(kindAt("wink", 1)).toBe("open");
      expect(kindAt("asleep", -1)).toBe("asleep");
      expect(kindAt("asleep", 1)).toBe("asleep");
      expect(kindAt("open", -1)).toBe("open");
    });

    it("draws two open eyes that the pose shifts to the side, with no cheeks and no shine", () => {
      expect(eyes(kitWith("open", 3), 26, 104)).toEqual([
        eye("open", 77, 104, 7, INK),
        eye("open", 129, 104, 7, INK),
      ]);
    });

    it("closes both eyes when they smile or sleep, and one when they wink, and marks only the open ones", () => {
      const marks = (open: typeof Eyes.Type) =>
        Arr.map(eyes(kitWith(open), 26, 104), (shape) => shape.mark);
      expect(marks("open")).toEqual(["eye", "eye"]);
      expect(marks("smile")).toEqual([undefined, undefined]);
      expect(marks("asleep")).toEqual([undefined, undefined]);
      expect(marks("wink")).toEqual([undefined, "eye"]);
    });

    it("takes its size and its ink from the animal when asked", () => {
      expect(eyes(kitWith("open"), 26, 96, 5, "#f6f4ef")).toEqual([
        eye("open", 74, 96, 5, "#f6f4ef"),
        eye("open", 126, 96, 5, "#f6f4ef"),
      ]);
    });
  });

  describe("faces", () => {
    it("draws a nose as a triangle pointing down, its corners rounded", () => {
      expect(nose(120, 8, 6, INK)).toEqual({
        _tag: "polygon",
        fill: INK,
        points: "92,117 108,117 100,123",
        stroke: INK,
        strokeLinejoin: "round",
        strokeWidth: 5.4,
      });
    });

    it("draws a smile as a closed lens and a grin and a mew as lines", () => {
      expect(smile(130, 10, 6, INK)).toMatchObject({
        _tag: "path",
        d: "M90,130 Q100,133 110,130 Q100,139.6 90,130 Z",
        fill: INK,
      });
      expect(grin(130, 10, 2, INK)).toMatchObject({
        d: "M90,130 Q100,134 110,130",
        fill: "none",
        strokeWidth: 3.2,
      });
      expect(mew(128, 8, INK)).toMatchObject({
        d: "M92,128 Q96,133 100,127 Q104,133 108,128",
        fill: "none",
      });
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
        "polygon",
        "polygon",
        "polygon",
        "polygon",
      ]);
      expect(ears[0]).toMatchObject({ fill: "#ee8a4c", strokeWidth: 14 });
      expect(ears[1]).toMatchObject({ fill: INK, strokeWidth: 6 });
    });

    it("draws one rounded triangle per spike, 4 wide unless told otherwise", () => {
      const ring = spikes(100, 108, 54, 80, 188, 352, 11, "#b98a63");
      expect(ring).toHaveLength(11);
      expect(Arr.every(ring, (spike) => spike.strokeWidth === 4)).toBe(true);
      expect(
        spikes(100, 108, 54, 80, 188, 352, 3, "#b98a63", 6)[0]
      ).toHaveProperty("strokeWidth", 6);
    });
  });
});
