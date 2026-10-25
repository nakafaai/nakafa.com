import type { Id } from "@repo/backend/confect/_generated/id";
import type {
  ImportedQuestion,
  ImportedRead,
  PlacedQuestion,
} from "@repo/backend/confect/exams/import";
import type {
  ImportPlaced,
  ImportSource,
} from "@repo/backend/confect/exams/imports.spec";
import {
  Array as Arr,
  type Cause,
  Effect,
  Option,
  type Result,
  Schema,
} from "effect";
import {
  sendStorageFile,
  storeExamImage,
} from "@/components/tenant/exams/image";
import {
  alignFigures,
  cropFigure,
} from "@/components/tenant/exams/import/figure";
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
import {
  readPictures,
  wordReads,
} from "@/components/tenant/exams/import/reads";
import { readWord } from "@/components/tenant/exams/import/word";

/**
 * How far one import has come: the parts read and the parts in the file, the questions placed,
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

/** The calls an import makes: Nina's read, the placement, the keys, and the upload of an exam image. */
type ImportCalls<ReadError, PlaceError, KeysError, UrlError, RegisterError> = {
  keys: (
    entries: readonly { answer: number; questionId: Id<"examQuestions"> }[]
  ) => Promise<Result.Result<{ keyed: number }, KeysError>>;
  place: (
    questions: readonly PlacedQuestion[]
  ) => Promise<Result.Result<typeof ImportPlaced.Type, PlaceError>>;
  read: (
    source: typeof ImportSource.Type
  ) => Promise<Result.Result<typeof ImportedRead.Type, ReadError>>;
  register: (args: {
    readonly height: number;
    readonly storageId: Id<"_storage">;
    readonly width: number;
  }) => Promise<
    Result.Result<{ readonly id: Id<"examAssets"> }, RegisterError>
  >;
  requestUrl: () => Promise<Result.Result<URL, UrlError>>;
};

/** One part of a file once it is ready: what Nina reads, and how one of her figures becomes an image of the exam. */
type PartValue = {
  readonly figure: (
    figure: ImportedQuestion["figures"][number]
  ) => Effect.Effect<Option.Option<Id<"examAssets">>>;
  readonly source: typeof ImportSource.Type;
};

/** Why a part of a PDF could not be made ready: a page that does not draw, or a page image that does not upload. */
type PartError<UrlError> =
  | Effect.Error<ReturnType<typeof renderPage>>
  | Effect.Error<ReturnType<typeof sendStorageFile>>
  | Cause.UnknownError
  | UrlError;

/**
 * Imports a teacher's file into an exam, one part at a time and in order, so the questions land
 * in the order of the file and the editor shows each part's questions as soon as they are placed.
 * The browser reads the file first: a file over 20 MB, or one whose bytes are no PDF or Word
 * document, is refused before anything is sent. A PDF's pages are drawn five at a time, and the
 * figures Nina boxes are cut from those drawings; a Word document is read as XML, and its
 * pictures become images of the exam before its first part. A figure that cannot be made is left
 * out, and its question keeps its text. Each placed question without a key takes the answer an
 * answer key table names later in the file. `onProgress` hears the progress after each part, and
 * the effect answers the last one. A PDF closes when the import ends, finished or stopped.
 */
export function runImport<
  ReadError,
  PlaceError,
  KeysError,
  UrlError,
  RegisterError,
>({
  file,
  onProgress,
  ...calls
}: ImportCalls<ReadError, PlaceError, KeysError, UrlError, RegisterError> & {
  file: Blob;
  onProgress: (progress: ImportProgress) => void;
}) {
  /** Uploads one file as an image of the exam, or none when it cannot be stored. */
  const storeImage = (image: File) =>
    storeExamImage({
      file: image,
      register: calls.register,
      requestUrl: calls.requestUrl,
    }).pipe(
      Effect.map((stored) => stored.id),
      Effect.option
    );

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
            parts: Arr.map(
              pageGroups(pdf.numPages),
              (group): Effect.Effect<PartValue, PartError<UrlError>> =>
                Effect.gen(function* () {
                  const pages = yield* Effect.forEach(group, (number) =>
                    renderPage(pdf, number)
                  );
                  const images = yield* Effect.forEach(pages, (page) =>
                    Effect.flatMap(awaited(calls.requestUrl), (url) =>
                      sendStorageFile(url, page.image)
                    )
                  );
                  return {
                    figure: (figure: ImportedQuestion["figures"][number]) =>
                      Option.match(
                        Option.all({
                          box: Option.fromNullOr(figure.box),
                          page: Option.flatMap(
                            Option.fromNullOr(figure.page),
                            (page) => Arr.get(pages, page - 1)
                          ),
                        }),
                        {
                          onNone: () => Effect.succeedNone,
                          onSome: ({ box, page }) =>
                            cropFigure(page.image, box).pipe(
                              Effect.option,
                              Effect.flatMap((cropped) =>
                                Option.match(cropped, {
                                  onNone: () => Effect.succeedNone,
                                  onSome: storeImage,
                                })
                              )
                            ),
                        }
                      ),
                    source: {
                      kind: "pages",
                      pages: Arr.zipWith(images, pages, (image, page) => ({
                        image,
                        text: page.text,
                      })),
                    },
                  };
                })
            ),
          }))
        : Effect.gen(function* () {
            const word = yield* readWord(bytes);
            const assets = yield* Effect.forEach(word.pictures, (picture) =>
              storeImage(
                new File([new Uint8Array(picture.bytes)], picture.name, {
                  type: picture.type,
                })
              )
            );
            return {
              mathType: word.mathType,
              parts: Arr.map(
                wordReads(word.lines),
                (text): Effect.Effect<PartValue, PartError<UrlError>> => {
                  const read = readPictures(text, assets);
                  return Effect.succeed({
                    figure: (figure: ImportedQuestion["figures"][number]) =>
                      Effect.succeed(
                        Option.flatMap(
                          Option.fromNullOr(figure.image),
                          (number) =>
                            Option.flatten(Arr.get(read.pictures, number - 1))
                        )
                      ),
                    source: {
                      images: Arr.getSomes(read.pictures),
                      kind: "text",
                      text: read.text,
                    },
                  });
                }
              ),
            };
          });
      const start: ImportProgress = {
        done: 0,
        keyless: 0,
        left: 0,
        mathType: plan.mathType,
        placed: 0,
        total: plan.parts.length,
      };
      onProgress(start);
      const finished = yield* Effect.reduce(
        plan.parts,
        () => ({
          numbered: Arr.empty<{
            readonly id: Id<"examQuestions">;
            readonly number: number | null;
          }>(),
          progress: start,
        }),
        (state, part) =>
          Effect.gen(function* () {
            const { figure, source } = yield* part;
            const read = yield* awaited(() => calls.read(source));
            const questions = yield* Effect.forEach(
              read.questions,
              (question) =>
                Effect.map(
                  Effect.forEach(question.figures, (each) =>
                    Effect.map(figure(each), (asset) =>
                      Option.map(asset, (id) => ({ alt: each.alt, asset: id }))
                    )
                  ),
                  (made): PlacedQuestion => ({
                    ...alignFigures(question, made),
                    answer: question.answer,
                    number: question.number,
                  })
                )
            );
            const placed = yield* awaited(() => calls.place(questions));
            const numbered = Arr.appendAll(state.numbered, placed.placed);
            const entries = Arr.getSomes(
              Arr.map(read.keys, (key) =>
                Option.map(
                  Arr.findLast(
                    numbered,
                    (question) => question.number === key.number
                  ),
                  (question) => ({
                    answer: key.answer,
                    questionId: question.id,
                  })
                )
              )
            );
            const { keyed } = Arr.isArrayNonEmpty(entries)
              ? yield* awaited(() => calls.keys(entries))
              : { keyed: 0 };
            const next: ImportProgress = {
              done: state.progress.done + 1,
              keyless: state.progress.keyless + placed.keyless - keyed,
              left: state.progress.left + placed.left,
              mathType: state.progress.mathType,
              placed: state.progress.placed + placed.placed.length,
              total: state.progress.total,
            };
            onProgress(next);
            return { numbered, progress: next };
          })
      );
      return finished.progress;
    })
  );
}
