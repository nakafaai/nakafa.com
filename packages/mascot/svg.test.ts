import { describe, expect, it } from "@effect/vitest";
import { Animal, DESIGNS } from "@repo/mascot/animal";
import { decode } from "@repo/mascot/code";
import { draw } from "@repo/mascot/draw";
import { Eyes } from "@repo/mascot/kit";
import { Pose } from "@repo/mascot/pose";
import drawings from "@repo/mascot/reference/drawing.json" with {
  type: "json",
};
import { markup, svg } from "@repo/mascot/svg";
import { sha256Hex } from "@repo/utilities/digest";
import { Array as Arr, Effect, Order, Record as Rec, Result } from "effect";

/** The mascot of a code that is known to be good. */
function mascotOf(code: string) {
  return Result.getOrThrow(decode(code));
}

describe("mascot/svg", () => {
  describe("markup", () => {
    it("writes a flat ellipse, and a turned one with its rotation", () => {
      expect(
        markup({
          _tag: "Ellipse",
          cx: 100,
          cy: 98,
          fill: "#ee8a4c",
          rx: 60,
          ry: 52,
        })
      ).toBe('<ellipse cx="100" cy="98" rx="60" ry="52" fill="#ee8a4c"/>');
      expect(
        markup({
          _tag: "Ellipse",
          cx: 100,
          cy: 98,
          fill: "#ee8a4c",
          rx: 60,
          ry: 52,
          transform: "rotate(22 100 98)",
        })
      ).toBe(
        '<ellipse cx="100" cy="98" rx="60" ry="52" fill="#ee8a4c" transform="rotate(22 100 98)"/>'
      );
    });

    it("writes an open eye with the class that a style can turn", () => {
      expect(
        markup({
          _tag: "Eye",
          cx: 74,
          cy: 94,
          fill: "#15294f",
          rx: 6.4,
          ry: 7.8,
        })
      ).toBe(
        '<ellipse class="nk-eye" cx="74" cy="94" rx="6.4" ry="7.8" fill="#15294f"/>'
      );
    });

    it("writes a path, and an outlined one with its stroke", () => {
      expect(markup({ _tag: "Path", d: "M0,0 L1,1 Z", fill: "#fff" })).toBe(
        '<path d="M0,0 L1,1 Z" fill="#fff"/>'
      );
      expect(
        markup({
          _tag: "Path",
          d: "M0,0 L1,1 Z",
          fill: "#fff",
          outline: { color: "#000", width: 2.6 },
        })
      ).toBe(
        '<path d="M0,0 L1,1 Z" fill="#fff" stroke="#000" stroke-width="2.6" stroke-linejoin="round"/>'
      );
    });

    it("writes a polygon rounded by a stroke of its own colour, and a line with round ends", () => {
      expect(
        markup({
          _tag: "Polygon",
          fill: "#15294f",
          points: "1,2 3,4 5,6",
          rounding: 3,
        })
      ).toBe(
        '<polygon points="1,2 3,4 5,6" fill="#15294f" stroke="#15294f" stroke-width="3" stroke-linejoin="round"/>'
      );
      expect(
        markup({ _tag: "Line", color: "#15294f", d: "M0,0 L9,9", width: 4.6 })
      ).toBe(
        '<path d="M0,0 L9,9" fill="none" stroke="#15294f" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/>'
      );
    });

    it("writes shapes that share one opacity inside one group", () => {
      expect(
        markup({
          _tag: "Fade",
          opacity: 0.3,
          shapes: [
            { _tag: "Path", d: "M0,0 Z", fill: "#fff" },
            { _tag: "Line", color: "#000", d: "M1,1 L2,2", width: 1 },
          ],
        })
      ).toBe(
        '<g opacity="0.3"><path d="M0,0 Z" fill="#fff"/><path d="M1,1 L2,2" fill="none" stroke="#000" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></g>'
      );
    });
  });

  describe("svg", () => {
    it("wraps the ground, and the layers in the pose, in one standalone document", () => {
      expect(
        svg({
          ground: "#243e66",
          parts: [{ _tag: "Path", d: "M0,0 Z", fill: "#fff" }],
          transform:
            "translate(100 204) rotate(0) scale(1.04) translate(-100 -200)",
        })
      ).toBe(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#243e66"/><g transform="translate(100 204) rotate(0) scale(1.04) translate(-100 -200)"><path d="M0,0 Z" fill="#fff"/></g></svg>'
      );
    });

    it.effect(
      "reproduces the prototype for every animal, palette, pose, and eyes value",
      () =>
        Effect.gen(function* () {
          const entries = Rec.toEntries(drawings);
          expect(entries).toHaveLength(3672);
          const wrong = yield* Effect.filter(entries, ([code, digest]) =>
            Effect.map(
              sha256Hex(svg(draw(mascotOf(code)))),
              (actual) => !actual.startsWith(digest)
            )
          );
          expect(Arr.map(wrong, ([code]) => code)).toEqual([]);
        }),
      // The bound only stops a hang. The case draws, writes, and digests 3,672
      // pictures with coverage counting every call, which takes about 3 seconds
      // on a quiet machine and has passed 5 seconds on a busy one.
      { timeout: 60_000 }
    );

    it("covers every animal, palette, pose, and eyes value once", () => {
      const expected = Arr.flatMap(Animal.literals, (animal) =>
        Arr.flatMap(DESIGNS[animal].colors, (_, palette) =>
          Arr.flatMap(Pose.literals, (pose) =>
            Arr.map(
              Eyes.literals,
              (eyes) => `${animal}.${palette}.${pose}.${eyes}`
            )
          )
        )
      );
      const covered = Arr.map(Rec.keys(drawings), (code) => {
        const [animal, palette, , pose, eyes] = code.split(".");
        return `${animal}.${palette}.${pose}.${eyes}`;
      });
      expect(Arr.sort(covered, Order.String)).toEqual(
        Arr.sort(expected, Order.String)
      );
    });

    it("gives every layer of a drawing markup of its own, so that a renderer can key by it", () => {
      const repeated = Arr.filter(Rec.keys(drawings), (code) => {
        const layers = Arr.map(draw(mascotOf(code)).parts, markup);
        return Arr.dedupe(layers).length !== layers.length;
      });
      expect(repeated).toEqual([]);
    });
  });
});
