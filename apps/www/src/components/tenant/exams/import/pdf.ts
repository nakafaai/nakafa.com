import { Array as Arr, Effect, Schema } from "effect";
import {
  IMPORT_PAGE_LIMIT,
  ImportFileRefused,
} from "@/components/tenant/exams/import/file";

/** The long edge of a page image in pixels: sharp enough for small print and formulas, and well under the 2 MB a page may take. */
const PAGE_EDGE = 1600;

/** The quality of a page image, which keeps print legible at a fraction of the bytes of PNG. */
const JPEG_QUALITY = 0.85;

/** The most pages one read sends to Nina. */
const PAGES_PER_READ = 5;

/** A file pdf.js cannot draw: it is damaged, or no PDF after all. */
const unreadable = () => new ImportFileRefused({ reason: "type" });

/**
 * Opens a PDF with pdf.js, which loads only now, so it is in no page's first JavaScript. pdf.js
 * runs no script of the file, and its script bundle stays unloaded. A PDF that needs a password is
 * refused as encrypted, and one with more than 30 pages as too long. The document closes, and its
 * worker stops, when the import's scope ends.
 */
export const openPdf = Effect.fn("exams.import.pdf")(function* (
  bytes: Uint8Array
) {
  const [pdfjs, worker] = yield* Effect.tryPromise({
    catch: unreadable,
    try: () =>
      Promise.all([
        import("pdfjs-dist"),
        import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
      ]),
  });
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = yield* Effect.acquireRelease(
    Effect.sync(() => pdfjs.getDocument({ data: bytes })),
    (loading) => Effect.promise(() => loading.destroy())
  );
  const pdf = yield* Effect.tryPromise({
    catch: (error) =>
      new ImportFileRefused({
        reason: error instanceof pdfjs.PasswordException ? "encrypted" : "type",
      }),
    try: () => task.promise,
  });
  if (pdf.numPages > IMPORT_PAGE_LIMIT) {
    return yield* new ImportFileRefused({ reason: "pages" });
  }
  return pdf;
});

/** The page numbers of a PDF in the groups that one read sends: five pages at a time, in order. */
export const pageGroups = (count: number) =>
  Arr.chunksOf(
    Arr.makeBy(count, (index) => index + 1),
    PAGES_PER_READ
  );

/** The size of a drawn page, which pdf.js calls its viewport. */
const Viewport = Schema.Struct({ height: Schema.Finite, width: Schema.Finite });

/**
 * The parts of a pdf.js page that the import uses: its viewport, its drawing and its text layer.
 * A pdf.js page is one, and so is a test's page, without pdf.js.
 */
interface DrawnPage<Size extends typeof Viewport.Type> {
  readonly cleanup: () => unknown;
  readonly getTextContent: () => Promise<{
    readonly items: readonly (
      | { readonly hasEOL: boolean; readonly str: string }
      | { readonly type: string }
    )[];
  }>;
  readonly getViewport: (options: { scale: number }) => Size;
  readonly render: (options: { canvas: HTMLCanvasElement; viewport: Size }) => {
    readonly promise: Promise<unknown>;
  };
}

/** The part of a pdf.js document that the import uses: its pages, by number from one. */
interface PageSource<Size extends typeof Viewport.Type> {
  readonly getPage: (number: number) => Promise<DrawnPage<Size>>;
}

/**
 * Draws one page as a JPEG image with its long edge at `PAGE_EDGE` pixels, and reads its text
 * layer, a line where the PDF ends one. Nina reads both: the image for layout and formulas, the
 * text for the exact words.
 */
export const renderPage = Effect.fn("exams.import.page")(function* <
  Size extends typeof Viewport.Type,
>(pdf: PageSource<Size>, number: number) {
  const page = yield* Effect.tryPromise({
    catch: unreadable,
    try: () => pdf.getPage(number),
  });
  const natural = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({
    scale: PAGE_EDGE / Math.max(natural.width, natural.height),
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  yield* Effect.tryPromise({
    catch: unreadable,
    try: () => page.render({ canvas, viewport }).promise,
  });
  const image = yield* Effect.callback<Blob, ImportFileRefused>((resume) => {
    canvas.toBlob(
      (blob) =>
        resume(
          blob === null ? Effect.fail(unreadable()) : Effect.succeed(blob)
        ),
      "image/jpeg",
      JPEG_QUALITY
    );
  });
  const content = yield* Effect.tryPromise({
    catch: unreadable,
    try: () => page.getTextContent(),
  });
  page.cleanup();
  const text = Arr.join(
    Arr.map(content.items, (item) => {
      if (!("str" in item)) {
        return "";
      }
      return item.hasEOL ? `${item.str}\n` : `${item.str} `;
    }),
    ""
  );
  return { image, text: text.trim() };
});
