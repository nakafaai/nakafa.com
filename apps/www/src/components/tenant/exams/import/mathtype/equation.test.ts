import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import {
  mathTypeEquation,
  readEquation,
} from "@/components/tenant/exams/import/mathtype/equation";

// The OLE container has its own tests; here an object's bytes are its equation stream.
vi.mock("@/components/tenant/exams/import/mathtype/ole", () => ({
  oleStream: (bytes: Uint8Array) => Effect.succeed(bytes),
}));

/** The bytes of a text, one per character. */
const ascii = (text: string) =>
  Arr.map(Arr.fromIterable(text), (character) => character.charCodeAt(0));

/** The 28-byte header MathType writes before an equation, then the MTEF 5 header of MathType 6. */
const PREFIX = [
  28,
  ...Arr.makeBy(27, () => 0),
  5,
  1,
  0,
  6,
  9,
  ...ascii("DSMT6"),
  0,
  0,
];

/** The typefaces the cases use. */
const TEXT = 1;
const FUNCTION = 2;
const VARIABLE = 3;
const GREEK = 4;
const SYMBOL = 6;
const NUMBER = 8;
const EXPAND = 22;
const MARKER = 23;
const SPACE = 24;

/** A line of records. */
const line = (...items: readonly (readonly number[])[]) => [
  1,
  0,
  ...Arr.flatten(items),
  0,
];

/** A null line, which holds nothing. */
const NULL_LINE = [1, 1];

/** A character of a typeface by its code, with the options given. */
const char = (face: number, code: number, options = 0) => [
  2,
  options,
  face + 128,
  code % 256,
  Math.floor(code / 256),
];

/** The characters of a text in one typeface. */
const chars = (text: string, face = VARIABLE) =>
  Arr.flatMap(ascii(text), (code) => char(face, code));

/** A character with marks. */
const marked = (face: number, code: number, ...marks: readonly number[]) => [
  ...char(face, code, 0x01),
  ...Arr.flatMap(marks, (mark) => [6, 0, mark]),
  0,
];

/** A template of a selector and variation with its slots and structure characters. */
const tmpl = (
  selector: number,
  variation: number,
  ...slots: readonly (readonly number[])[]
) => [3, 0, selector, variation, 0, ...Arr.flatten(slots), 0];

/** A pile of lines in an alignment. */
const pile = (alignment: number, ...lines: readonly (readonly number[])[]) => [
  4,
  0,
  alignment,
  0,
  ...Arr.flatten(lines),
  0,
];

/** An equation stream whose one line holds these records. */
const stream = (...items: readonly (readonly number[])[]) =>
  Uint8Array.from([...PREFIX, ...line(...items), 0]);

/** The LaTeX of each case, an equation whose one line holds the case's records. */
const latexOfAll = (cases: readonly (readonly number[])[]) =>
  Effect.forEach(cases, (records) => readEquation(stream(records)));

const A = chars("a");
const B = chars("b");

describe("readEquation", () => {
  it.effect(
    "writes each character by its typeface: math, a text run, a function name, a space or a marker",
    () =>
      Effect.gen(function* () {
        expect(
          yield* latexOfAll([
            [...chars("x"), ...char(SYMBOL, 0x2b), ...chars("y")],
            [...char(GREEK, 0x3_b1), ...chars("x")],
            [
              ...chars("50", TEXT),
              ...char(TEXT, 0x25),
              ...char(TEXT, 0xa0),
              ...char(TEXT, 0x5c),
            ],
            char(TEXT, 0x3_a6),
            [
              ...chars("sin", FUNCTION),
              ...char(FUNCTION, 0x63, 0x02),
              ...chars("os", FUNCTION),
            ],
            [...chars("a"), ...char(FUNCTION, 0x2c), ...chars("b")],
            [...chars("x"), ...char(MARKER, 0x20), ...chars("y")],
            [...chars("a"), ...char(SPACE, 0xef_04), ...chars("b")],
            [
              ...marked(VARIABLE, 0x78, 9, 5),
              ...marked(TEXT, 0x78, 9),
              ...marked(FUNCTION, 0x66, 5),
            ],
            // A character inside a mark list is no mark, and draws nothing.
            [...char(VARIABLE, 0x78, 0x01), 6, 0, 9, ...chars("y"), 0],
          ])
        ).toEqual([
          "x+y",
          "\\alpha x",
          "\\text{50\\% \\textbackslash{}}",
          "\\Phi",
          "\\sin\\cos",
          "a,b",
          "xy",
          "a\\;b",
          "\\hat{x}'\\hat{x}f'",
          "\\hat{x}",
        ]);
      })
  );

  it.effect(
    "reads templates, piles and matrices from their records, a pile or matrix filling a slot",
    () =>
      Effect.gen(function* () {
        expect(
          yield* latexOfAll([
            tmpl(1, 3, line(A), char(EXPAND, 0x28), char(EXPAND, 0x29)),
            [
              3,
              0,
              15,
              0x81,
              0x01,
              0,
              ...line(A),
              ...NULL_LINE,
              ...NULL_LINE,
              0,
            ],
            [
              ...chars("x"),
              ...tmpl(28, 0, NULL_LINE, line(chars("2", NUMBER))),
            ],
            pile(
              4,
              line([
                ...chars("x"),
                ...char(SYMBOL, 0x3d),
                ...chars("1", NUMBER),
              ]),
              line(A)
            ),
            [4, 0x02, 1, 0, 7, 1, 0, 0x10, 0, ...line(A), ...line(B), 0],
            tmpl(2, 1, pile(1, line(A), line(B)), char(EXPAND, 0x7b)),
            tmpl(1, 3, [5, 0, 0, 0, 0, 1, 2, 0, 0, ...line(A), ...line(B), 0]),
          ])
        ).toEqual([
          "\\left( a \\right)",
          "\\int\\nolimits a",
          "x^{2}",
          "\\begin{aligned} x&=1 \\\\ a \\end{aligned}",
          "\\begin{array}{l} a \\\\ b \\end{array}",
          "\\left\\{ \\begin{array}{l} a \\\\ b \\end{array} \\right.",
          "\\left( \\begin{matrix} a & b \\end{matrix} \\right)",
        ]);
      })
  );

  it.effect(
    "reads past nudges, font positions, line options and every record that only styles an equation",
    () =>
      Effect.gen(function* () {
        expect(
          yield* latexOfAll([
            [
              ...[2, 0x08, 130, 132, 128 + VARIABLE, 0x61, 0],
              ...[
                2,
                0x1c,
                128,
                128,
                1,
                0,
                2,
                0,
                128 + VARIABLE,
                0x62,
                0,
                9,
                1,
                0,
              ],
            ],
            [2, 0, 0xff, 0x03, 0x80, 0x61, 0],
            [1, 0x0e, 130, 130, 0x10, 0, 7, 0, ...A, 0],
            [
              ...[8, 1, 0],
              ...[9, 101, 0x00, 0xf0],
              ...[9, 100, 1, 0x10, 0x00],
              ...[9, 1, 128],
              ...[10],
              ...[14],
              ...[15, 1],
              ...[16, 0, 0, 0, 0, 0, 0, 0],
              ...[16, 0x05, 0, 0, 0, 0, 0, 0, 0, 0, ...ascii("red"), 0],
              ...[17, 255, 0x00, 0x01, ...ascii("Times"), 0],
              ...[18, 0, 2, 0x21, 0xf2, 0x5f, 1, 0x23, 0xf0, 2, 1, 0, 0],
              ...[19, ...ascii("MTCode"), 0],
              ...[7, 1, 0, 0, 0],
              ...[100, 3, 1, 2, 3],
              // A mark outside a character draws nothing.
              ...[6, 0, 9],
              ...A,
            ],
          ])
        ).toEqual(["ab", "a", "a", "a"]);
      })
  );

  it.effect(
    "keeps the picture of an equation it cannot write, or whose bytes it cannot read",
    () =>
      Effect.gen(function* () {
        const reasons = yield* Effect.forEach(
          [
            stream(char(VARIABLE, 0xe0_00)),
            stream(char(TEXT, 0xe0_00)),
            stream(marked(VARIABLE, 0x78, 16)),
            stream([2, 0x20, 128 + VARIABLE]),
            stream(tmpl(26, 0, line(A), NULL_LINE)),
            stream([5, 0, 0, 0, 0, 1, 1, 0x40, 0, ...line(A), 0]),
            stream([5, 0, 0, 0, 0, 1, 2, 0, 0, ...line(A), 0]),
            stream([5, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
            stream([50, 0]),
            stream(
              Arr.reduce(Arr.range(1, 70), A, (inner) =>
                tmpl(11, 0, line(inner), line(B))
              )
            ),
            stream(A).subarray(0, PREFIX.length + 4),
            Uint8Array.from([28, ...Arr.makeBy(27, () => 0), 3, 1]),
            new Uint8Array(0),
            Uint8Array.from([5]),
          ],
          (bytes) =>
            Effect.map(Effect.flip(readEquation(bytes)), ({ reason }) => reason)
        );
        expect(reasons).toEqual([
          ...Arr.makeBy(8, () => "unsupported"),
          "record",
          "record",
          "truncated",
          "version",
          "truncated",
          "truncated",
        ]);
      })
  );
});

describe("mathTypeEquation", () => {
  it.effect(
    "writes an equation that KaTeX draws, and keeps the picture of one it does not",
    () =>
      Effect.gen(function* () {
        const square = tmpl(28, 0, NULL_LINE, line(chars("2", NUMBER)));
        expect(yield* mathTypeEquation(stream(chars("x"), square))).toBe(
          "x^{2}"
        );
        const refusal = yield* Effect.flip(
          mathTypeEquation(stream(chars("x"), square, square))
        );
        expect(refusal.reason).toBe("unsupported");
      })
  );
});
