import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  type ImportedQuestion,
  type ImportedRead,
  ImportUnread,
} from "@repo/backend/confect/exams/import";
import type { ImportSource } from "@repo/backend/confect/exams/reads.spec";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect, MutableList, Result, Schema } from "effect";
import { FetchHttpClient } from "effect/http";
import { strToU8, zipSync } from "fflate";
import type { ImportProgress } from "@/components/tenant/exams/import/run";
import { runImport } from "@/components/tenant/exams/import/run";

vi.mock("@/components/tenant/exams/import/pdf", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/tenant/exams/import/pdf")
  >("@/components/tenant/exams/import/pdf");
  const { Effect: Fx } = await import("effect");
  return {
    ...actual,
    openPdf: () => Fx.succeed({ numPages: 7 }),
    renderPage: (_pdf: unknown, number: number) =>
      Fx.succeed({ image: new Blob(["jpeg"]), text: `Halaman ${number}` }),
  };
});

vi.mock("@/components/tenant/exams/import/figure", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/tenant/exams/import/figure")
  >("@/components/tenant/exams/import/figure");
  const { Effect: Fx } = await import("effect");
  return {
    ...actual,
    cropFigure: (_page: Blob, box: { readonly top: number }) =>
      box.top === 0
        ? Fx.fail(new actual.FigureUncut())
        : Fx.succeed(new File(["png"], "figure.png", { type: "image/png" })),
  };
});

/** The IDs the fake backend gives: one image of the exam and the placed questions. */
const ASSET = Schema.decodeUnknownSync(Id("examAssets"))("asset-1");
const FIRST = Schema.decodeUnknownSync(Id("examQuestions"))("question-1");
const SECOND = Schema.decodeUnknownSync(Id("examQuestions"))("question-2");

/** One file-level fetch double for every upload, as AGENTS.md asks: each upload answers its storage ID. */
const fetcher = vi.fn<typeof fetch>(() =>
  Promise.resolve(
    new Response(encodeJsonText({ storageId: "stored-1" }), {
      headers: { "content-type": "application/json" },
      status: 200,
    })
  )
);

/** The calls of an import against a fake backend, with Nina's reads given in order. */
const backend = (reads: readonly (typeof ImportedRead.Type)[]) => {
  const read =
    vi.fn<
      (
        source: typeof ImportSource.Type
      ) => Promise<Result.Result<typeof ImportedRead.Type, ImportUnread>>
    >();
  for (const answer of reads) {
    read.mockResolvedValueOnce(Result.succeed(answer));
  }
  return {
    keys: vi.fn(() => Promise.resolve(Result.succeed({ keyed: 1 }))),
    place: vi.fn((questions: readonly unknown[]) =>
      Promise.resolve(
        Result.succeed({
          keyless: questions.length,
          left: 0,
          placed: Arr.map(questions, (_, index) => ({
            id: index === 0 ? FIRST : SECOND,
            number: index + 1,
          })),
        })
      )
    ),
    read,
    register: vi.fn(() => Promise.resolve(Result.succeed({ id: ASSET }))),
    requestUrl: () =>
      Promise.resolve(Result.succeed(new URL("https://upload.test/file"))),
  };
};

/** A question as Nina reads it, with the given figures. */
const question = (
  prompt: string,
  figures: readonly Omit<ImportedQuestion["figures"][number], "alt">[]
) => ({
  answer: null,
  explanation: "",
  figures: Arr.map(figures, (figure) => ({ ...figure, alt: "Gambar" })),
  number: 1,
  options: ["A", "B"],
  prompt,
});

/** A Word file with one picture and one question that shows it. */
const wordFile = () =>
  new Blob([
    zipSync({
      "[Content_Types].xml": strToU8(
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'
      ),
      "word/_rels/document.xml.rels": strToU8(
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="media/image1.png"/></Relationships>'
      ),
      "word/document.xml": strToU8(
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body><w:p><w:r><w:t>Berapa sudutnya?</w:t></w:r><w:r><w:drawing><a:blip r:embed="rId1"/></w:drawing></w:r></w:p></w:body></w:document>'
      ),
      "word/media/image1.png": strToU8("png"),
    }),
  ]);

/** Collects the progress an import reports. */
const progressLog = () => {
  const seen = MutableList.make<ImportProgress>();
  return {
    onProgress: (progress: ImportProgress) =>
      MutableList.append(seen, progress),
    seen: () => MutableList.toArray(seen),
  };
};

describe("runImport", () => {
  beforeEach(() => {
    fetcher.mockClear();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(() => Promise.resolve({ close: vi.fn(), height: 30, width: 40 }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.effect(
    "refuses a file over 20 MB and one that is no PDF or Word file before it sends anything",
    () =>
      Effect.gen(function* () {
        const calls = backend([]);
        const log = progressLog();
        const refusals = yield* Effect.forEach(
          [
            new Blob([new Uint8Array(20 * 1024 * 1024 + 1)]),
            new Blob(["GIF89a"]),
          ],
          (file) =>
            runImport({ ...calls, file, onProgress: log.onProgress }).pipe(
              Effect.flip
            )
        );
        expect(Arr.map(refusals, (refusal) => refusal._tag)).toEqual([
          "ImportFileRefused",
          "ImportFileRefused",
        ]);
        expect(calls.read).not.toHaveBeenCalled();
        expect(log.seen()).toEqual([]);
      })
  );

  it.effect(
    "stores a Word file's pictures as images of the exam, shows them to Nina, and places her questions with them",
    () =>
      Effect.gen(function* () {
        const calls = backend([
          {
            keys: [],
            questions: [
              question("Berapa sudutnya?\n{{figure:1}}", [
                { box: null, image: 1, page: null },
              ]),
            ],
          },
        ]);
        const log = progressLog();
        const last = yield* runImport({
          ...calls,
          file: wordFile(),
          onProgress: log.onProgress,
        }).pipe(Effect.provideService(FetchHttpClient.Fetch, fetcher));
        expect(calls.read).toHaveBeenCalledWith({
          images: [ASSET],
          kind: "text",
          text: "Berapa sudutnya?[image 1]",
        });
        expect(calls.place).toHaveBeenCalledWith([
          {
            answer: null,
            explanation: "",
            figures: [{ alt: "Gambar", asset: ASSET }],
            number: 1,
            options: ["A", "B"],
            prompt: "Berapa sudutnya?\n{{figure:1}}",
          },
        ]);
        expect(calls.keys).not.toHaveBeenCalled();
        expect(last).toEqual({
          done: 1,
          keyless: 1,
          left: 0,
          mathType: 0,
          placed: 1,
          total: 1,
        });
        expect(Arr.map(log.seen(), (progress) => progress.done)).toEqual([
          0, 1,
        ]);
      })
  );

  it.effect(
    "draws a PDF five pages at a time, cuts Nina's figures from the pages, and keys a question from a later key table",
    () =>
      Effect.gen(function* () {
        const calls = backend([
          {
            keys: [],
            questions: [
              question("Lihat\n{{figure:1}}\n{{figure:2}}\n{{figure:3}}", [
                {
                  box: { bottom: 500, left: 100, right: 500, top: 100 },
                  image: null,
                  page: 1,
                },
                {
                  box: { bottom: 500, left: 100, right: 500, top: 0 },
                  image: null,
                  page: 2,
                },
                { box: null, image: 1, page: null },
              ]),
            ],
          },
          {
            keys: [
              { answer: 2, number: 1 },
              { answer: 0, number: 9 },
            ],
            questions: [],
          },
        ]);
        const last = yield* runImport({
          ...calls,
          file: new Blob(["%PDF-1.7\n"]),
          onProgress: () => undefined,
        }).pipe(Effect.provideService(FetchHttpClient.Fetch, fetcher));
        expect(calls.read).toHaveBeenNthCalledWith(1, {
          kind: "pages",
          pages: Arr.map([1, 2, 3, 4, 5], (number) => ({
            image: "stored-1",
            text: `Halaman ${number}`,
          })),
        });
        expect(calls.place).toHaveBeenNthCalledWith(1, [
          expect.objectContaining({
            figures: [{ alt: "Gambar", asset: ASSET }],
            prompt: "Lihat\n{{figure:1}}\n\n",
          }),
        ]);
        expect(calls.keys).toHaveBeenCalledWith([
          { answer: 2, questionId: FIRST },
        ]);
        expect(last).toMatchObject({
          done: 2,
          keyless: 0,
          placed: 1,
          total: 2,
        });
      })
  );

  it.effect("stops at a read that fails", () =>
    Effect.gen(function* () {
      const calls = backend([]);
      calls.read.mockResolvedValueOnce(Result.fail(new ImportUnread()));
      const failure = yield* runImport({
        ...calls,
        file: wordFile(),
        onProgress: () => undefined,
      }).pipe(
        Effect.provideService(FetchHttpClient.Fetch, fetcher),
        Effect.flip
      );
      expect(failure).toBeInstanceOf(ImportUnread);
      expect(calls.place).not.toHaveBeenCalled();
    })
  );
});
