import { NodeServices } from "@effect/platform-node";
import arabicRanges from "@fontsource-variable/noto-naskh-arabic/unicode.json" with {
  type: "json",
};
import { ALLO_FACES } from "@repo/backend/confect/pdf/allo";
import type { PdfFrame } from "@repo/backend/confect/pdf/frame";
import {
  PAGE_SIDE,
  PageFooter,
  PageHeader,
  PDF_FONT,
} from "@repo/backend/confect/pdf/frame";
import { THEME_COMPATIBILITY_COLORS } from "@repo/palette/colors";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import {
  Array as Arr,
  Effect,
  FileSystem,
  Option,
  Path,
  pipe,
  Record,
  Schema,
  String as Str,
} from "effect";
import { Base64 } from "effect/encoding";
import type { ReactElement } from "react";
import { createElement } from "react";
import { render } from "takumi-pdf";

/** The PDF could not be drawn. */
export class PdfRenderError extends Schema.TaggedError<
  PdfRenderError,
  { readonly brand: unique symbol }
>()("PdfRenderError", {
  code: Schema.Literal("PDF_RENDER_FAILED"),
  message: Schema.String,
}) {}

/**
 * The design system's colors a document paints with, as the classes the app
 * names them by. The renderer reads no CSS variable, so each token becomes one
 * rule from the sRGB projection the theme contract keeps in step with the app.
 */
const TOKENS = {
  border: { property: "border-color", token: "border" },
  "bg-muted": { property: "background-color", token: "muted" },
  "text-foreground": { property: "color", token: "foreground" },
  "text-muted-foreground": { property: "color", token: "muted-foreground" },
  "text-primary": { property: "color", token: "primary" },
} as const;

/**
 * The document stylesheet: the tokens above, no browser margins around a
 * paragraph or heading, and digits of one width, so columns of numbers align.
 */
const PDF_STYLES = pipe(
  TOKENS,
  Record.toEntries,
  Arr.map(
    ([name, rule]) =>
      `.${name}{${rule.property}:${THEME_COMPATIBILITY_COLORS.light[rule.token]}}`
  ),
  Arr.appendAll(["p,h2{margin:0}", "main{font-variant-numeric:tabular-nums}"]),
  Arr.join("")
);

/** The Arabic subset of Noto Naskh Arabic, the face Arabic text draws in. */
const ARABIC_FACE =
  "@fontsource-variable/noto-naskh-arabic/files/noto-naskh-arabic-arabic-wght-normal.woff2";

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

/** One subset's bytes under the family every document names, with the code points it serves. */
const face = (data: Uint8Array, ranges: string) => ({
  data,
  name: PDF_FONT,
  unicodeRange: pipe(ranges, Str.split(","), Arr.map(codePoints)),
});

/**
 * The subsets a document can draw, under its one family: every Latin name and
 * Vietnamese in Allo, which the documents carry, and Arabic in Noto Naskh
 * Arabic, which ships with the action. The renderer refuses a character no
 * subset covers, so a learner's name must never fall outside them.
 */
const readFaces = Effect.fn("pdf.fonts")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const allo = yield* Effect.forEach(ALLO_FACES, (subset) =>
    Effect.map(Effect.fromResult(Base64.decode(subset.data)), (data) =>
      face(data, subset.ranges)
    )
  );
  const file = yield* path.fromFileUrl(
    new URL(import.meta.resolve(ARABIC_FACE))
  );
  const arabic = face(yield* fs.readFile(file), arabicRanges.arabic);
  return [...allo, arabic];
});

/**
 * Draws one document as an A4 PDF in the one Nakafa frame: the header with the
 * mark, the title, and the identifier on every page, the body, and the footer
 * with the issuer, the contact address, the identifier, and the page number.
 */
export const renderPdf = Effect.fn("pdf.render")(function* (
  body: ReactElement,
  frame: typeof PdfFrame.Type
) {
  // The fonts ship with the action, so a font that cannot be read is a broken deployment.
  const fonts = yield* readFaces().pipe(
    Effect.orDie,
    Effect.provide(NodeServices.layer)
  );
  const bytes = yield* Effect.tryPromise({
    catch: (cause) =>
      new PdfRenderError({
        code: "PDF_RENDER_FAILED",
        message: String(cause),
      }),
    try: () =>
      render(body, {
        css: PDF_STYLES,
        fonts,
        footer: createElement(PageFooter, { frame }),
        header: createElement(PageHeader, { frame }),
        lang: frame.language,
        margin: { left: PAGE_SIDE, right: PAGE_SIDE },
        metadata: { authors: [COMPANY_IDENTITY.legalName], title: frame.name },
        size: "a4",
      }),
  });
  return new Uint8Array(bytes);
});
