// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import type { Pen } from "@repo/design-system/components/three/print/draw";
import {
  drawSheet,
  soleInk,
  solidInk,
} from "@repo/design-system/components/three/print/draw";
import type { Sheet } from "@repo/design-system/components/three/print/sheet";
import { words } from "@repo/design-system/components/three/print/sheet";
import { Array as Arr, MutableList, Option, Schema } from "effect";

/** One stroke a pen was asked for. */
const StrokeSchema = Schema.Struct({
  ink: Schema.String,
  kind: Schema.String,
  shape: Schema.Record(Schema.String, Schema.Unknown),
  strength: Schema.optionalKey(Schema.Finite),
  text: Schema.optionalKey(Schema.String),
});

/** A sheet 0.2 m by 0.1 m drawn at 1000 pixels per metre. */
const PIXELS = { height: 100, width: 200 };

function sheetOf(marks: Sheet["marks"]): Sheet {
  return { height: 0.1, marks, width: 0.2 };
}

/**
 * The strokes a sheet asks of a pen in one pass, in a face whose characters
 * are half as wide as their size.
 */
function drawn(sheet: Sheet, pass: Parameters<typeof drawSheet>[3]) {
  const strokes = MutableList.make<typeof StrokeSchema.Type>();
  const pen: Pen = {
    arc: (shape, ink) =>
      MutableList.append(strokes, { ink, kind: "arc", shape }),
    band: (shape, ink) =>
      MutableList.append(strokes, { ink, kind: "band", shape }),
    disc: (shape, ink, strength) =>
      MutableList.append(strokes, { ink, kind: "disc", shape, strength }),
    frame: (shape, ink) =>
      MutableList.append(strokes, { ink, kind: "frame", shape }),
    line: (shape, ink) =>
      MutableList.append(strokes, { ink, kind: "line", shape }),
    measure: (text, type) => text.length * type.size * 0.5,
    text: (text, place, type, ink) =>
      MutableList.append(strokes, {
        ink,
        kind: "text",
        shape: { ...place, ...type },
        text,
      }),
  };
  drawSheet(pen, sheet, PIXELS, pass);
  return MutableList.toArray(strokes);
}

describe("drawing the coverage of a sheet", () => {
  it("floods the image with no ink, then draws every mark in white", () => {
    const strokes = drawn(
      sheetOf([
        {
          from: [-0.1, 0],
          ink: "red",
          kind: "line",
          to: [0.1, 0.05],
          width: 0.002,
        },
      ]),
      "cover"
    );
    expect(strokes[0]).toEqual({
      ink: "#000000",
      kind: "band",
      shape: { height: 100, radius: 0, width: 200, x: 0, y: 0 },
    });
    expect(strokes[1]).toEqual({
      ink: "#ffffff",
      kind: "line",
      shape: { from: [0, 50], to: [200, 0], width: 2 },
    });
  });

  it("places a band, a frame and an arc about their anchors, y turned downwards", () => {
    const strokes = drawn(
      sheetOf([
        {
          at: [0.05, 0.02],
          height: 0.02,
          ink: "a",
          kind: "band",
          radius: 0.001,
          width: 0.04,
        },
        {
          at: [0, 0],
          height: 0.08,
          ink: "a",
          kind: "frame",
          line: 0.002,
          radius: 0.004,
          width: 0.18,
        },
        {
          at: [0, -0.01],
          from: 2,
          ink: "a",
          kind: "arc",
          radius: 0.03,
          to: 1,
          width: 0.003,
        },
      ]),
      "cover"
    );
    expect(strokes[1]?.shape).toEqual({
      height: 20,
      radius: 1,
      width: 40,
      x: 130,
      y: 20,
    });
    expect(strokes[2]?.shape).toEqual({
      height: 80,
      line: 2,
      radius: 4,
      width: 180,
      x: 10,
      y: 10,
    });
    expect(strokes[3]?.shape).toEqual({
      from: 2,
      radius: 30,
      to: 1,
      width: 3,
      x: 100,
      y: 60,
    });
  });

  it("draws a screen of dots at their strength, every other row shifted by half a pitch", () => {
    const strokes = drawn(
      sheetOf([
        { ink: "a", kind: "dots", pitch: 0.05, radius: 0.005, strength: 0.2 },
      ]),
      "cover"
    );
    const dots = Arr.drop(strokes, 1);
    expect(dots).toHaveLength(8);
    expect(dots[0]).toMatchObject({
      shape: { radius: 5, x: 25, y: 25 },
      strength: 0.2,
    });
    expect(dots[4]?.shape).toEqual({ radius: 5, x: 50, y: 75 });
  });

  it("draws no dots without a pitch", () => {
    const strokes = drawn(
      sheetOf([
        { ink: "a", kind: "dots", pitch: 0, radius: 0.005, strength: 1 },
      ]),
      "cover"
    );
    expect(strokes).toHaveLength(1);
  });
});

describe("drawing the text of a sheet", () => {
  it("centres a text on its anchor, its baseline half a capital below", () => {
    const strokes = drawn(
      sheetOf([words({ at: [0, 0], ink: "a", size: 0.02, text: "kPa" })]),
      "cover"
    );
    expect(strokes[1]).toMatchObject({
      shape: { face: "sans", grow: 0, size: 20, turn: 0, weight: 700, x: 85 },
      text: "kPa",
    });
    expect(strokes[1]?.shape.y).toBeCloseTo(57.2);
  });

  it("starts or ends a text at its anchor when the author says so", () => {
    const strokes = drawn(
      sheetOf([
        words({ align: "start", at: [0, 0], ink: "a", size: 0.02, text: "ab" }),
        words({ align: "end", at: [0, 0], ink: "a", size: 0.02, text: "ab" }),
      ]),
      "cover"
    );
    expect(strokes[1]?.shape.x).toBe(100);
    expect(strokes[2]?.shape.x).toBe(80);
  });

  it("sets a formula's scripts smaller, off the baseline, after what stands before them", () => {
    const strokes = drawn(
      sheetOf([
        words({
          align: "start",
          at: [-0.1, 0],
          ink: "a",
          size: 0.02,
          text: "dm³",
        }),
      ]),
      "cover"
    );
    expect(strokes[1]).toMatchObject({ shape: { size: 20, x: 0 }, text: "dm" });
    expect(strokes[2]).toMatchObject({ shape: { size: 14, x: 20 }, text: "3" });
    expect(strokes[2]?.shape.y).toBeCloseTo(57.2 - 0.363 * 20);
  });

  it("turns a text about its anchor", () => {
    const strokes = drawn(
      sheetOf([
        words({
          at: [0, 0],
          ink: "a",
          size: 0.02,
          text: "ab",
          turn: Math.PI / 2,
        }),
      ]),
      "cover"
    );
    // Read upwards: it starts below its anchor, its baseline to the right of it.
    expect(strokes[1]?.shape.x).toBeCloseTo(107.2);
    expect(strokes[1]?.shape.y).toBeCloseTo(60);
    expect(strokes[1]?.shape.turn).toBe(Math.PI / 2);
  });

  it("fits a text to its box: smaller type, broken between words, its lines centred", () => {
    const strokes = drawn(
      sheetOf([
        words({
          align: "start",
          at: [-0.1, 0],
          box: { height: 0.08, leading: 1.2, smallest: 0.005, width: 0.1 },
          ink: "a",
          size: 0.03,
          text: "All odd numbers here are prime",
        }),
      ]),
      "cover"
    );
    const lines = Arr.drop(strokes, 1);
    expect(lines.length).toBeGreaterThan(1);
    expect(
      Arr.join(
        Arr.map(lines, (line) => line.text ?? ""),
        " "
      )
    ).toBe("All odd numbers here are prime");
    const size = Number(lines[0]?.shape.size);
    expect(size).toBeLessThan(30);
    for (const line of lines) {
      expect((line.text?.length ?? 0) * size * 0.5).toBeLessThanOrEqual(100);
    }
    const first = Number(lines[0]?.shape.y);
    const last = Number(Option.getOrUndefined(Arr.last(lines))?.shape.y);
    expect((first + last) / 2).toBeCloseTo(50 + 0.36 * size);
  });
});

describe("drawing the colours of a sheet", () => {
  const sheet = sheetOf([
    { from: [0, 0], ink: "teal", kind: "line", to: [0.1, 0], width: 0.002 },
    {
      at: [0, 0],
      height: 0.02,
      ink: "red",
      kind: "band",
      radius: 0,
      width: 0.04,
    },
    {
      at: [0, 0],
      height: 0.02,
      ink: "red",
      kind: "frame",
      line: 0.002,
      radius: 0,
      width: 0.04,
    },
    {
      at: [0, 0],
      from: 0,
      ink: "red",
      kind: "arc",
      radius: 0.03,
      to: 1,
      width: 0.002,
    },
    { ink: "grey", kind: "dots", pitch: 0.1, radius: 0.005, strength: 0.2 },
    words({ at: [0, 0], ink: "ink", size: 0.02, text: "V" }),
  ]);

  it("floods the image with the first ink and grows every mark past its edge", () => {
    const strokes = drawn(sheet, "tint");
    expect(strokes[0]).toMatchObject({ ink: "teal", kind: "band" });
    expect(strokes[1]).toMatchObject({ ink: "teal", shape: { width: 6 } });
    expect(strokes[2]).toMatchObject({
      ink: "red",
      shape: { height: 24, width: 44, x: 78, y: 38 },
    });
    expect(strokes[3]).toMatchObject({ shape: { line: 6 } });
    expect(strokes[4]).toMatchObject({ shape: { width: 6 } });
    expect(strokes[5]).toMatchObject({
      ink: "grey",
      shape: { radius: 7 },
      strength: 1,
    });
    expect(Option.getOrUndefined(Arr.last(strokes))).toMatchObject({
      ink: "ink",
      shape: { grow: 2 },
    });
  });

  it("floods a sheet without marks with black", () => {
    const strokes = drawn(sheetOf([]), "tint");
    expect(strokes).toEqual([
      {
        ink: "#000000",
        kind: "band",
        shape: { height: 100, radius: 0, width: 200, x: 0, y: 0 },
      },
    ]);
  });
});

describe("what a sheet's inks ask of the renderer", () => {
  const tick = {
    from: [0, 0],
    kind: "line",
    to: [0.1, 0],
    width: 0.002,
  } as const;

  it("names the one ink of a sheet printed in one", () => {
    expect(
      soleInk(
        sheetOf([
          { ...tick, ink: "white" },
          { ...tick, ink: "white" },
        ])
      )
    ).toEqual(Option.some("white"));
  });

  it("names none for a sheet printed in several", () => {
    expect(
      soleInk(
        sheetOf([
          { ...tick, ink: "teal" },
          { ...tick, ink: "grey" },
        ])
      )
    ).toEqual(Option.none());
  });

  it("calls ink at full strength solid, and a faint screen of dots not", () => {
    const dots = {
      ink: "a",
      kind: "dots",
      pitch: 0.01,
      radius: 0.001,
    } as const;
    expect(solidInk(sheetOf([{ ...tick, ink: "a" }]))).toBe(true);
    expect(solidInk(sheetOf([{ ...dots, strength: 1 }]))).toBe(true);
    expect(solidInk(sheetOf([{ ...dots, strength: 0.13 }]))).toBe(false);
  });
});
