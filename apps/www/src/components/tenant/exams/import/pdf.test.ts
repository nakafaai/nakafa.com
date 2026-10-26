import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, Exit, Schema } from "effect";
import {
  openPdf,
  pageGroups,
  renderPage,
} from "@/components/tenant/exams/import/pdf";

const pdfjs = vi.hoisted(() => ({
  GlobalWorkerOptions: { workerSrc: "" },
  PasswordException: class PasswordException {},
  getDocument: vi.fn(),
}));

vi.mock("pdfjs-dist", () => pdfjs);
vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({
  default: "/assets/pdf.worker.js",
}));

/** What pdf.js answers for an opened document: its page count. */
const Opened = Schema.Struct({ numPages: Schema.Int });

/** A loading task of pdf.js that settles with `opened`, and its teardown. */
const loading = (opened: Promise<typeof Opened.Type>) => {
  const destroy = vi.fn(() => Promise.resolve());
  pdfjs.getDocument.mockReturnValue({ destroy, promise: opened });
  return destroy;
};

/** A page of 600 by 800 points whose text layer holds two lines and a marked span. */
const page = () => ({
  cleanup: vi.fn(),
  getTextContent: () =>
    Promise.resolve({
      items: [
        { hasEOL: true, str: "1. Berapa 2 + 3?" },
        { type: "beginMarkedContent" },
        { hasEOL: false, str: "A. 5" },
      ],
    }),
  getViewport: ({ scale }: { scale: number }) => ({
    height: 800 * scale,
    width: 600 * scale,
  }),
  render: vi.fn(() => ({ promise: Promise.resolve() })),
});

describe("openPdf", () => {
  it.effect(
    "opens a PDF with the worker that loads with it, and closes it when the import ends",
    () =>
      Effect.gen(function* () {
        const destroy = loading(Promise.resolve({ numPages: 3 }));
        const bytes = new TextEncoder().encode("%PDF-1.7");
        const pdf = yield* Effect.scoped(openPdf(bytes));
        expect(pdf.numPages).toBe(3);
        expect(pdfjs.GlobalWorkerOptions.workerSrc).toBe(
          "/assets/pdf.worker.js"
        );
        expect(pdfjs.getDocument).toHaveBeenCalledWith({ data: bytes });
        expect(destroy).toHaveBeenCalledTimes(1);
      })
  );

  it.effect(
    "refuses a PDF longer than 30 pages, one with a password, and one pdf.js cannot read",
    () =>
      Effect.gen(function* () {
        const bytes = new TextEncoder().encode("%PDF-1.7");
        const refusals = yield* Effect.forEach(
          [
            Promise.resolve({ numPages: 31 }),
            Promise.reject(new pdfjs.PasswordException()),
            Promise.reject(new Error("Invalid PDF structure")),
          ],
          (opened) => {
            const destroy = loading(opened);
            return Effect.scoped(openPdf(bytes)).pipe(
              Effect.flip,
              Effect.tap(() =>
                Effect.sync(() => expect(destroy).toHaveBeenCalledTimes(1))
              )
            );
          }
        );
        expect(Arr.map(refusals, (refusal) => refusal.reason)).toEqual([
          "pages",
          "encrypted",
          "type",
        ]);
      })
  );
});

describe("pageGroups", () => {
  it("groups the pages five at a time, in order", () => {
    expect(pageGroups(12)).toEqual([
      [1, 2, 3, 4, 5],
      [6, 7, 8, 9, 10],
      [11, 12],
    ]);
  });
});

describe("renderPage", () => {
  it.effect(
    "draws a page with its long edge at 1600 pixels as a JPEG, and reads its text layer by lines",
    () =>
      Effect.gen(function* () {
        const drawn = page();
        const toBlob = vi
          .spyOn(HTMLCanvasElement.prototype, "toBlob")
          .mockImplementation((callback) => callback(new Blob(["jpeg"])));
        const result = yield* renderPage(
          { getPage: () => Promise.resolve(drawn) },
          1
        );
        expect(result.text).toBe("1. Berapa 2 + 3?\nA. 5");
        expect(result.image.size).toBe(4);
        expect(drawn.render).toHaveBeenCalledWith(
          expect.objectContaining({ viewport: { height: 1600, width: 1200 } })
        );
        expect(toBlob).toHaveBeenCalledWith(
          expect.any(Function),
          "image/jpeg",
          0.85
        );
        expect(drawn.cleanup).toHaveBeenCalledTimes(1);
        toBlob.mockRestore();
      })
  );

  it.effect(
    "refuses a page that pdf.js cannot open, draw, encode or read",
    () =>
      Effect.gen(function* () {
        const failing = (overrides: Partial<ReturnType<typeof page>>) => ({
          getPage: () => Promise.resolve({ ...page(), ...overrides }),
        });
        const encoded = vi
          .spyOn(HTMLCanvasElement.prototype, "toBlob")
          .mockImplementation((callback) => callback(new Blob(["jpeg"])));
        const exits = yield* Effect.forEach(
          [
            renderPage({ getPage: () => Promise.reject(new Error("gone")) }, 1),
            renderPage(
              failing({
                render: vi.fn(() => ({
                  promise: Promise.reject(new Error("draw")),
                })),
              }),
              1
            ),
            renderPage(
              failing({
                getTextContent: () => Promise.reject(new Error("text")),
              }),
              1
            ),
          ],
          Effect.exit
        );
        encoded.mockImplementation((callback) => callback(null));
        const unencoded = yield* Effect.exit(renderPage(failing({}), 1));
        encoded.mockRestore();
        expect(Arr.every(Arr.append(exits, unencoded), Exit.isFailure)).toBe(
          true
        );
      })
  );
});
