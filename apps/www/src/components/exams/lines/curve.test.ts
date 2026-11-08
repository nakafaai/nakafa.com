import { describe, expect, it } from "@effect/vitest";
import { matchAnswers, textLabel } from "@repo/backend/confect/exams/blank";
import { Array as Arr, Option } from "effect";
import {
  boardPoint,
  isPull,
  lineNames,
  linePath,
  nameOf,
  removePoint,
} from "@/components/exams/lines/curve";

describe("linePath and removePoint", () => {
  it("leaves each dot level and bends once halfway, in either direction", () => {
    expect(linePath({ x: 0, y: 10 }, { x: 100, y: 50 })).toBe(
      "M 0 10 C 50 10 50 50 100 50"
    );
    expect(linePath({ x: 100, y: 10 }, { x: 0, y: 10 })).toBe(
      "M 100 10 C 50 10 50 10 0 10"
    );
  });

  it("stands a line's remove control in the middle of the gap, on its statement's row", () => {
    expect(removePoint({ x: 200, y: 40 }, { x: 300, y: 90 })).toEqual({
      x: 250,
      y: 40,
    });
    // A paper written right to left puts its answers on the left, and the control still stands between the dots.
    expect(removePoint({ x: 200, y: 40 }, { x: 100, y: 90 })).toEqual({
      x: 150,
      y: 40,
    });
  });
});

describe("boardPoint and isPull", () => {
  it("reads a point of the screen in the board's own pixels, at any zoom", () => {
    const box = { left: 100, top: 50, width: 400 };
    expect(boardPoint({ x: 300, y: 150 }, box, 400)).toEqual({
      x: 200,
      y: 100,
    });
    // The editor draws the paper at half its size, so a screen pixel is two of the board's.
    expect(boardPoint({ x: 300, y: 150 }, { ...box, width: 200 }, 400)).toEqual(
      { x: 400, y: 200 }
    );
  });

  it("takes a scale of one for a board that has no width yet", () => {
    expect(
      boardPoint({ x: 10, y: 20 }, { left: 0, top: 0, width: 0 }, 0)
    ).toEqual({ x: 10, y: 20 });
  });

  it("keeps a press that wobbles a press, and makes a longer move a pull", () => {
    expect(isPull({ x: 0, y: 0 }, { x: 2, y: 2 })).toBe(false);
    expect(isPull({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(true);
  });
});

describe("lineNames and nameOf", () => {
  it("numbers the statements and letters the answers, in the script of the answers", () => {
    const [match] = matchAnswers();
    const names = lineNames(match);
    expect(names.sources).toEqual([
      { id: "source-1", name: "1" },
      { id: "source-2", name: "2" },
      { id: "source-3", name: "3" },
    ]);
    expect(names.targets).toEqual([
      { id: "target-1", name: "A" },
      { id: "target-2", name: "B" },
      { id: "target-3", name: "C" },
    ]);
    const arabic = lineNames({
      ...match,
      targets: Arr.map(match.targets, (part) => ({
        ...part,
        label: textLabel("كتاب"),
      })),
    });
    expect(arabic.targets[0]?.name).toBe("أ");
    expect(nameOf(names, "target-2")).toEqual(Option.some("B"));
    expect(nameOf(names, "source-3")).toEqual(Option.some("3"));
    expect(nameOf(names, "gone")).toEqual(Option.none());
  });
});
