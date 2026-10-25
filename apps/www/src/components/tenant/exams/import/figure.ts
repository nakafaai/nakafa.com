import type { ImportedQuestion } from "@repo/backend/confect/exams/import";
import { Array as Arr, Effect, Option, Result, Schema } from "effect";

/** The smallest figure worth keeping, in pixels on a side: anything smaller is a speck Nina boxed by mistake. */
const MIN_FIGURE_EDGE = 12;

/** A figure the browser could not cut from its page: its box holds nothing, or the page does not decode. */
export class FigureUncut extends Schema.TaggedError<FigureUncut>()(
  "FigureUncut",
  {}
) {}

/** The box of a figure on its page, in thousandths of the page width and height from its top left corner. */
type Box = NonNullable<ImportedQuestion["figures"][number]["box"]>;

/** The pixel rectangle a box takes on a page of this size, its corners in order whatever order Nina gave them. */
export const pixelsOf = (box: Box, width: number, height: number) => {
  const left = Math.min(box.left, box.right);
  const top = Math.min(box.top, box.bottom);
  return {
    height: Math.round(((Math.max(box.top, box.bottom) - top) / 1000) * height),
    width: Math.round(((Math.max(box.left, box.right) - left) / 1000) * width),
    x: Math.round((left / 1000) * width),
    y: Math.round((top / 1000) * height),
  };
};

/**
 * Cuts one figure from the image of its page as a PNG file, which keeps the lines of a diagram
 * sharp. A box smaller than `MIN_FIGURE_EDGE` on a side, or a page that does not decode, fails
 * with `FigureUncut`, and the question keeps its text without that figure.
 */
export const cropFigure = Effect.fn("exams.import.crop")(function* (
  page: Blob,
  box: Box
) {
  const bitmap = yield* Effect.tryPromise({
    catch: () => new FigureUncut(),
    try: () => createImageBitmap(page),
  });
  const area = pixelsOf(box, bitmap.width, bitmap.height);
  if (area.width < MIN_FIGURE_EDGE || area.height < MIN_FIGURE_EDGE) {
    bitmap.close();
    return yield* new FigureUncut();
  }
  const canvas = document.createElement("canvas");
  canvas.width = area.width;
  canvas.height = area.height;
  canvas
    .getContext("2d")
    ?.drawImage(
      bitmap,
      area.x,
      area.y,
      area.width,
      area.height,
      0,
      0,
      area.width,
      area.height
    );
  bitmap.close();
  const blob = yield* Effect.callback<Blob, FigureUncut>((resume) => {
    canvas.toBlob(
      (image) =>
        resume(
          image === null
            ? Effect.fail(new FigureUncut())
            : Effect.succeed(image)
        ),
      "image/png"
    );
  });
  return new File([blob], "figure.png", { type: "image/png" });
});

/** The mark of figure K in a question's text, as Nina writes it. */
const FIGURE_MARK = /\{\{figure:(\d+)\}\}/gu;

/**
 * A question's text and figures once its figures are images of the exam. A figure that could not
 * be made is gone, its mark with it, and the marks of the figures after it count down, so every
 * mark still names its own figure.
 */
export const alignFigures = <Figure>(
  question: Pick<ImportedQuestion, "explanation" | "options" | "prompt">,
  made: readonly Option.Option<Figure>[]
) => {
  const kept = Arr.filterMap(made, (figure, index) =>
    Option.match(figure, {
      onNone: () => Result.failVoid,
      onSome: () => Result.succeed(index + 1),
    })
  );
  const renumber = (text: string) =>
    text.replace(FIGURE_MARK, (_, digits: string) =>
      Option.match(
        Arr.findFirstIndex(
          kept,
          (number) => number === Number.parseInt(digits, 10)
        ),
        { onNone: () => "", onSome: (index) => `{{figure:${index + 1}}}` }
      )
    );
  return {
    explanation: renumber(question.explanation),
    figures: Arr.getSomes(made),
    options: Arr.map(question.options, renumber),
    prompt: renumber(question.prompt),
  };
};
