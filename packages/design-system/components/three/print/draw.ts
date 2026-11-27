import { fitText } from "@repo/design-system/components/three/print/fit";
import { setFormula } from "@repo/design-system/components/three/print/formula";
import type {
  Mark,
  Sheet,
} from "@repo/design-system/components/three/print/sheet";
import { getColor } from "@repo/design-system/lib/color";
import { Array as Arr, Match, Option, Schema } from "effect";

/**
 * Draws a sheet with a pen: every mark of the print, turned from metres on
 * the object into pixels of the image the renderer lights. A sheet is drawn
 * in two passes, since the renderer keeps the edge of every mark sharp from
 * its coverage alone, and reads the relief of the ink from it too.
 */

/**
 * What draws: the few strokes a print is made of, in pixels, y downwards.
 * A canvas is one; a test records what it is asked for. A shape is drawn in
 * an ink at a `strength` from 0 to 1, and a text starts at a point of its
 * baseline, turned about that point, with its strokes grown by `grow`.
 */
export interface Pen {
  readonly arc: (
    shape: {
      readonly from: number;
      readonly radius: number;
      readonly to: number;
      readonly width: number;
      readonly x: number;
      readonly y: number;
    },
    ink: string
  ) => void;
  readonly band: (
    shape: {
      readonly height: number;
      readonly radius: number;
      readonly width: number;
      readonly x: number;
      readonly y: number;
    },
    ink: string
  ) => void;
  readonly disc: (
    shape: { readonly radius: number; readonly x: number; readonly y: number },
    ink: string,
    strength: number
  ) => void;
  readonly frame: (
    shape: {
      readonly height: number;
      readonly line: number;
      readonly radius: number;
      readonly width: number;
      readonly x: number;
      readonly y: number;
    },
    ink: string
  ) => void;
  readonly line: (
    shape: {
      readonly from: readonly [number, number];
      readonly to: readonly [number, number];
      readonly width: number;
    },
    ink: string
  ) => void;
  readonly measure: (text: string, type: Type) => number;
  readonly text: (
    text: string,
    place: {
      readonly grow: number;
      readonly turn: number;
      readonly x: number;
      readonly y: number;
    },
    type: Type,
    ink: string
  ) => void;
}

/** The type a text is set in: its face, its size in pixels and its weight. */
const TypeSchema = Schema.Struct({
  face: Schema.Literals(["mono", "sans"]),
  size: Schema.Finite,
  weight: Schema.Finite,
});
type Type = typeof TypeSchema.Type;

/**
 * Which image of a sheet a pass draws:
 * - `cover`: how much ink lies at each pixel, white on black, which the
 *   renderer reads as where the ink is and as its relief
 * - `tint`: the colour of each mark alone, grown past its edge, so the edge
 *   of a mark never blends towards a colour that is not ink
 */
const PassSchema = Schema.Literals(["cover", "tint"]);
type Pass = typeof PassSchema.Type;

/** The size of an image in pixels. */
const PixelsSchema = Schema.Struct({
  height: Schema.Finite,
  width: Schema.Finite,
});
type Pixels = typeof PixelsSchema.Type;

/** How far a mark's colour reaches past its edge in the tint pass, in pixels. */
const BLEED = 2;

/** How far below a text's middle its baseline lies, in em: half the height of a capital. */
const CAPITAL = 0.36;

/** What a pass needs of a sheet to place a mark: the pixels per metre, the image, and the pass. */
const FrameSchema = Schema.Struct({
  grow: Schema.Finite,
  pass: PassSchema,
  pixels: PixelsSchema,
  scale: Schema.Finite,
});
type Frame = typeof FrameSchema.Type;

/** A place on the sheet as a pixel of the image. */
function pixelOf(frame: Frame, at: readonly [number, number]) {
  return [
    frame.pixels.width / 2 + at[0] * frame.scale,
    frame.pixels.height / 2 - at[1] * frame.scale,
  ] as const;
}

/** The ink a mark is drawn in: its own, or white where the pass maps coverage. */
function inkOf(frame: Frame, ink: string) {
  return frame.pass === "cover" ? getColor("WHITE") : ink;
}

/** Draws a text mark: fitted to its box when it has one, set as a formula, aligned and turned about its anchor. */
function drawText(
  pen: Pen,
  frame: Frame,
  mark: Extract<Mark, { kind: "text" }>
) {
  const [x, y] = pixelOf(frame, mark.at);
  const type = (size: number): Type => ({
    face: mark.face,
    size,
    weight: mark.weight,
  });
  const widthAt = (text: string, size: number) =>
    setFormula(text, size, (run, runSize) => pen.measure(run, type(runSize)))
      .width;
  const largest = mark.size * frame.scale;
  const setting =
    mark.box === undefined
      ? { leading: 1, lines: [mark.text], size: largest }
      : {
          leading: mark.box.leading,
          ...fitText(
            mark.text,
            {
              height: mark.box.height * frame.scale,
              leading: mark.box.leading,
              width: mark.box.width * frame.scale,
            },
            { largest, smallest: mark.box.smallest * frame.scale },
            (text) => widthAt(text, 100) / 100
          ),
        };
  const cos = Math.cos(mark.turn);
  const sin = Math.sin(mark.turn);
  Arr.forEach(setting.lines, (line, index) => {
    const set = setFormula(line, setting.size, (run, runSize) =>
      pen.measure(run, type(runSize))
    );
    const start = Match.value(mark.align).pipe(
      Match.when("start", () => 0),
      Match.when("middle", () => -set.width / 2),
      Match.when("end", () => -set.width),
      Match.exhaustive
    );
    const down =
      (index - (setting.lines.length - 1) / 2) *
        setting.size *
        setting.leading +
      CAPITAL * setting.size;
    Arr.forEach(set.runs, (run) => {
      const along = start + run.x;
      const below = down - run.lift;
      pen.text(
        run.text,
        {
          grow: frame.grow,
          turn: mark.turn,
          x: x + along * cos + below * sin,
          y: y - along * sin + below * cos,
        },
        type(run.size),
        inkOf(frame, mark.ink)
      );
    });
  });
}

/** Draws a screen of dots over the whole image, every other row shifted by half a pitch. */
function drawDots(
  pen: Pen,
  frame: Frame,
  mark: Extract<Mark, { kind: "dots" }>
) {
  const pitch = mark.pitch * frame.scale;
  if (!(pitch > 0)) {
    return;
  }
  const rows = Math.ceil(frame.pixels.height / pitch);
  const columns = Math.ceil(frame.pixels.width / pitch);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      pen.disc(
        {
          radius: mark.radius * frame.scale + frame.grow,
          x: (column + 0.5 + (row % 2) * 0.5) * pitch,
          y: (row + 0.5) * pitch,
        },
        inkOf(frame, mark.ink),
        frame.pass === "tint" ? 1 : mark.strength
      );
    }
  }
}

/** Draws one mark of a sheet. */
function drawMark(pen: Pen, frame: Frame, mark: Mark) {
  const ink = inkOf(frame, mark.ink);
  const grown = 2 * frame.grow;
  Match.value(mark).pipe(
    Match.discriminatorsExhaustive("kind")({
      arc: (arc) => {
        const [x, y] = pixelOf(frame, arc.at);
        pen.arc(
          {
            from: arc.from,
            radius: arc.radius * frame.scale,
            to: arc.to,
            width: arc.width * frame.scale + grown,
            x,
            y,
          },
          ink
        );
      },
      band: (band) => {
        const [x, y] = pixelOf(frame, band.at);
        const width = band.width * frame.scale + grown;
        const height = band.height * frame.scale + grown;
        pen.band(
          {
            height,
            radius: band.radius * frame.scale,
            width,
            x: x - width / 2,
            y: y - height / 2,
          },
          ink
        );
      },
      dots: (dots) => drawDots(pen, frame, dots),
      frame: (outline) => {
        const [x, y] = pixelOf(frame, outline.at);
        const width = outline.width * frame.scale;
        const height = outline.height * frame.scale;
        pen.frame(
          {
            height,
            line: outline.line * frame.scale + grown,
            radius: outline.radius * frame.scale,
            width,
            x: x - width / 2,
            y: y - height / 2,
          },
          ink
        );
      },
      line: (line) =>
        pen.line(
          {
            from: pixelOf(frame, line.from),
            to: pixelOf(frame, line.to),
            width: line.width * frame.scale + grown,
          },
          ink
        ),
      text: (text) => drawText(pen, frame, text),
    })
  );
}

/** The ink of a sheet's first mark, which the tint pass floods the image with. */
function firstInk(sheet: Sheet) {
  return Option.match(Arr.head(sheet.marks), {
    onNone: () => getColor("BLACK"),
    onSome: (first) => first.ink,
  });
}

/**
 * Draws one pass of a sheet into an image of `pixels`, whose width spans
 * the sheet's width: the image is flooded with no ink, or with the first
 * ink's colour, and every mark is drawn over it.
 *
 * @param pen - What draws
 * @param sheet - The print
 * @param pixels - The size of the image
 * @param pass - Which image of the sheet to draw
 */
export function drawSheet(pen: Pen, sheet: Sheet, pixels: Pixels, pass: Pass) {
  const frame: Frame = {
    grow: pass === "tint" ? BLEED : 0,
    pass,
    pixels,
    scale: pixels.width / sheet.width,
  };
  pen.band(
    { height: pixels.height, radius: 0, width: pixels.width, x: 0, y: 0 },
    pass === "cover" ? getColor("BLACK") : firstInk(sheet)
  );
  Arr.forEach(sheet.marks, (mark) => drawMark(pen, frame, mark));
}

/** The one ink every mark of a sheet is printed in, when there is only one, so its colour needs no image of its own. */
export function soleInk(sheet: Sheet): Option.Option<string> {
  const ink = firstInk(sheet);
  return Arr.every(sheet.marks, (mark) => mark.ink === ink)
    ? Option.some(ink)
    : Option.none();
}

/**
 * Whether every mark of a sheet is printed at full strength, so its coverage
 * is ink or no ink and its edges can be drawn sharp however far a reader
 * zooms in.
 */
export function solidInk(sheet: Sheet): boolean {
  return Arr.every(
    sheet.marks,
    (mark) => mark.kind !== "dots" || mark.strength >= 1
  );
}
