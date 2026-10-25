import type {
  ImportPlaced,
  ImportSource,
} from "@repo/backend/confect/exams/imports.spec";
import { Array as Arr, Effect, type Result, Schema } from "effect";
import { sendStorageFile } from "@/components/tenant/exams/image";
import {
  fileKindOf,
  IMPORT_BYTE_LIMIT,
  ImportFileRefused,
} from "@/components/tenant/exams/import/file";
import {
  openPdf,
  pageGroups,
  renderPage,
} from "@/components/tenant/exams/import/pdf";
import { readWord, wordReads } from "@/components/tenant/exams/import/word";

/**
 * How far one import has come: the reads sent and the reads in the file, the questions placed,
 * how many of them still need a key, how many questions were left out, and the MathType
 * equations of a Word file, which the teacher types again.
 */
export const ImportProgress = Schema.Struct({
  done: Schema.Int,
  keyless: Schema.Int,
  left: Schema.Int,
  mathType: Schema.Int,
  placed: Schema.Int,
  total: Schema.Int,
});
export type ImportProgress = typeof ImportProgress.Type;

/** The bytes at the start of a file that decide its kind. */
const HEAD_BYTES = 8;

/** Awaits one call's answer, and fails with the typed error that the answer holds. */
const awaited = <A, E>(call: () => Promise<Result.Result<A, E>>) =>
  Effect.tryPromise(call).pipe(Effect.flatMap(Effect.fromResult));

/**
 * Imports a teacher's file into an exam, one read at a time and in order, so the questions land
 * in the order of the file and the editor shows each read's questions as soon as it is placed.
 * The browser reads the file first: a file over 20 MB, or one whose bytes are no PDF or Word
 * document, is refused before anything is sent. A PDF's pages are drawn five at a time and their
 * images uploaded before their read; a Word document is read as XML. `onProgress` hears the
 * progress after each read, and the effect answers the last one. A PDF closes when the import
 * ends, whether it finished or stopped.
 */
export function runImport<UrlError, ReadError>({
  file,
  onProgress,
  read,
  requestUrl,
}: {
  file: Blob;
  onProgress: (progress: ImportProgress) => void;
  read: (
    source: typeof ImportSource.Type
  ) => Promise<Result.Result<typeof ImportPlaced.Type, ReadError>>;
  requestUrl: () => Promise<Result.Result<URL, UrlError>>;
}) {
  return Effect.scoped(
    Effect.gen(function* () {
      if (file.size > IMPORT_BYTE_LIMIT) {
        return yield* new ImportFileRefused({ reason: "size" });
      }
      const bytes = new Uint8Array(
        yield* Effect.promise(() => file.arrayBuffer())
      );
      const kind = yield* Effect.fromOption(
        fileKindOf(bytes.slice(0, HEAD_BYTES))
      ).pipe(Effect.mapError(() => new ImportFileRefused({ reason: "type" })));
      const plan = yield* kind === "pdf"
        ? Effect.map(openPdf(bytes), (pdf) => ({
            mathType: 0,
            sources: Arr.map(pageGroups(pdf.numPages), (group) =>
              Effect.map(
                Effect.forEach(group, (number) =>
                  Effect.gen(function* () {
                    const page = yield* renderPage(pdf, number);
                    const url = yield* awaited(requestUrl);
                    const image = yield* sendStorageFile(url, page.image);
                    return { image, text: page.text };
                  })
                ),
                (pages): typeof ImportSource.Type => ({ kind: "pages", pages })
              )
            ),
          }))
        : Effect.map(readWord(bytes), (word) => ({
            mathType: word.mathType,
            sources: Arr.map(wordReads(word.lines), (text) =>
              Effect.succeed<typeof ImportSource.Type>({ kind: "text", text })
            ),
          }));
      const start: ImportProgress = {
        done: 0,
        keyless: 0,
        left: 0,
        mathType: plan.mathType,
        placed: 0,
        total: plan.sources.length,
      };
      onProgress(start);
      return yield* Effect.reduce(
        plan.sources,
        () => start,
        (progress, source) =>
          Effect.gen(function* () {
            const built = yield* source;
            const placed = yield* awaited(() => read(built));
            const next: ImportProgress = {
              done: progress.done + 1,
              keyless: progress.keyless + placed.keyless,
              left: progress.left + placed.left,
              mathType: progress.mathType,
              placed: progress.placed + placed.placed,
              total: progress.total,
            };
            onProgress(next);
            return next;
          })
      );
    })
  );
}
