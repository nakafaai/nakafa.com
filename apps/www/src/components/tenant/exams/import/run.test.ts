import { describe, expect, it } from "@effect/vitest";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect, MutableList, Result } from "effect";
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

/** The answer of one read: two questions placed, one of them without its key. */
const placedRead = () =>
  Promise.resolve(Result.succeed({ keyless: 1, left: 0, placed: 2 }));

/** The address that `exams.assets.uploadUrl` answers with. */
const requestUrl = () =>
  Promise.resolve(Result.succeed(new URL("https://upload.test/file")));

/** A Word file with one numbered question and its two options. */
const wordFile = () =>
  new Blob([
    zipSync({
      "[Content_Types].xml": strToU8(
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'
      ),
      "word/document.xml": strToU8(
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Berapa 2 + 3?</w:t></w:r></w:p></w:body></w:document>'
      ),
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
  it.effect(
    "refuses a file over 20 MB and one that is no PDF or Word file before it sends anything",
    () =>
      Effect.gen(function* () {
        const read = vi.fn(placedRead);
        const log = progressLog();
        const refusals = yield* Effect.forEach(
          [
            new Blob([new Uint8Array(20 * 1024 * 1024 + 1)]),
            new Blob(["GIF89a"]),
          ],
          (file) =>
            runImport({
              file,
              read,
              requestUrl,
              onProgress: log.onProgress,
            }).pipe(Effect.flip)
        );
        expect(Arr.map(refusals, (refusal) => refusal._tag)).toEqual([
          "ImportFileRefused",
          "ImportFileRefused",
        ]);
        expect(read).not.toHaveBeenCalled();
        expect(log.seen()).toEqual([]);
      })
  );

  it.effect(
    "sends a Word file's text in reads and counts what each read placed",
    () =>
      Effect.gen(function* () {
        const read = vi.fn(placedRead);
        const log = progressLog();
        const last = yield* runImport({
          file: wordFile(),
          onProgress: log.onProgress,
          read,
          requestUrl,
        });
        expect(read).toHaveBeenCalledWith({
          kind: "text",
          text: "Berapa 2 + 3?",
        });
        expect(last).toEqual({
          done: 1,
          keyless: 1,
          left: 0,
          mathType: 0,
          placed: 2,
          total: 1,
        });
        expect(Arr.map(log.seen(), (progress) => progress.done)).toEqual([
          0, 1,
        ]);
      })
  );

  it.effect(
    "draws a PDF five pages at a time, uploads each page image, and sends its reads in order",
    () =>
      Effect.gen(function* () {
        const fetcher = vi.fn<typeof fetch>(() =>
          Promise.resolve(
            new Response(encodeJsonText({ storageId: "page-image" }), {
              headers: { "content-type": "application/json" },
              status: 200,
            })
          )
        );
        const read = vi.fn(placedRead);
        const last = yield* runImport({
          file: new Blob(["%PDF-1.7\n"]),
          onProgress: () => undefined,
          read,
          requestUrl,
        }).pipe(Effect.provideService(FetchHttpClient.Fetch, fetcher));
        expect(fetcher).toHaveBeenCalledTimes(7);
        expect(read).toHaveBeenNthCalledWith(1, {
          kind: "pages",
          pages: Arr.map([1, 2, 3, 4, 5], (number) => ({
            image: "page-image",
            text: `Halaman ${number}`,
          })),
        });
        expect(read).toHaveBeenNthCalledWith(2, {
          kind: "pages",
          pages: [
            { image: "page-image", text: "Halaman 6" },
            { image: "page-image", text: "Halaman 7" },
          ],
        });
        expect(last).toMatchObject({ done: 2, placed: 4, total: 2 });
      })
  );

  it.effect("stops at a read that fails, with the reads before it placed", () =>
    Effect.gen(function* () {
      const read = vi.fn(() =>
        Promise.resolve(Result.fail({ _tag: "ImportUnread" as const }))
      );
      const failure = yield* runImport({
        file: wordFile(),
        onProgress: () => undefined,
        read,
        requestUrl,
      }).pipe(Effect.flip);
      expect(failure).toEqual({ _tag: "ImportUnread" });
    })
  );
});
