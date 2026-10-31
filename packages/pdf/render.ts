import { NodeServices } from "@effect/platform-node";
import interRanges from "@fontsource-variable/inter/unicode.json" with {
  type: "json",
};
import arabicRanges from "@fontsource-variable/noto-naskh-arabic/unicode.json" with {
  type: "json",
};
import {
  Array as Arr,
  Effect,
  FileSystem,
  Option,
  Path,
  pipe,
  Schema,
  String as Str,
} from "effect";
import type { ReactElement } from "react";
import { render } from "takumi-pdf";

/** The family every document draws with. */
export const PDF_FONT = "Inter";

/** Who a document names as its author. */
export const PDF_AUTHOR = "PT Nakafa Tekno Kreatif";

/** The PDF could not be drawn. */
export class PdfRenderError extends Schema.TaggedError<PdfRenderError>()(
  "PdfRenderError",
  {
    code: Schema.Literal("PDF_RENDER_FAILED"),
    message: Schema.String,
  }
) {}

/** The title a document carries in its properties, in the language it is written in. */
const PdfDetails = Schema.Struct({
  language: Schema.String,
  title: Schema.String,
});

/**
 * The subsets a document can draw: every Latin name, Vietnamese, and Arabic.
 * The renderer refuses a character no subset covers, so a learner's name must
 * never fall outside them.
 */
const FACES = [
  {
    file: "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
    ranges: interRanges.latin,
  },
  {
    file: "@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2",
    ranges: interRanges["latin-ext"],
  },
  {
    file: "@fontsource-variable/inter/files/inter-vietnamese-wght-normal.woff2",
    ranges: interRanges.vietnamese,
  },
  {
    file: "@fontsource-variable/noto-naskh-arabic/files/noto-naskh-arabic-arabic-wght-normal.woff2",
    ranges: arabicRanges.arabic,
  },
];

/** Reads one `U+0041` or `U+0041-005A` entry of a CSS unicode range as its first and last code point. */
const codePoints = (entry: string): [number, number] => {
  const bounds = pipe(
    entry,
    Str.trim,
    Str.replace("U+", ""),
    Str.split("-"),
    Arr.map((bound) => Number.parseInt(bound, 16))
  );
  const first = Arr.headNonEmpty(bounds);
  return [first, Option.getOrElse(Arr.get(bounds, 1), () => first)];
};

/** Reads one subset's file and the code points it serves. */
const readFace = Effect.fn("pdf.font")(function* (
  face: (typeof FACES)[number]
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = yield* path.fromFileUrl(new URL(import.meta.resolve(face.file)));
  const data = yield* fs.readFile(file);
  return {
    data,
    name: PDF_FONT,
    unicodeRange: pipe(face.ranges, Str.split(","), Arr.map(codePoints)),
  };
});

/** Draws one document as an A4 PDF, with the subsets it may need and its title in its properties. */
export const renderPdf = Effect.fn("pdf.render")(
  function* (document: ReactElement, details: typeof PdfDetails.Type) {
    const fonts = yield* Effect.forEach(FACES, readFace);
    const bytes = yield* Effect.tryPromise({
      catch: (cause) =>
        new PdfRenderError({
          code: "PDF_RENDER_FAILED",
          message: String(cause),
        }),
      try: () =>
        render(document, {
          fonts,
          lang: details.language,
          metadata: { authors: [PDF_AUTHOR], title: details.title },
          size: "a4",
        }),
    });
    return new Uint8Array(bytes);
  },
  (effect) =>
    effect.pipe(
      Effect.catchTag("PlatformError", (cause) =>
        Effect.fail(
          new PdfRenderError({
            code: "PDF_RENDER_FAILED",
            message: cause.message,
          })
        )
      ),
      Effect.provide(NodeServices.layer)
    )
);
