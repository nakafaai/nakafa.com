import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect, Match, MutableRef, Option, Schema } from "effect";
import { ImportFileRefused } from "@/components/tenant/exams/import/file";
import {
  type ImportProgress,
  runImport,
} from "@/components/tenant/exams/import/run";
import { reportClientException } from "@/lib/analytics/client";

/** A toast that stays until the import replaces it with its result. */
const UNTIL_REPLACED = Number.POSITIVE_INFINITY;

/** The toast of a file the browser refused, which names what to do instead. */
const refusedCopy = (error: ImportFileRefused) =>
  Match.value(error.reason).pipe(
    Match.when("type", () => "import-type" as const),
    Match.when("size", () => "import-size" as const),
    Match.when("pages", () => "import-pages" as const),
    Match.when("macro", () => "import-macro" as const),
    Match.when("encrypted", () => "import-encrypted" as const),
    Match.exhaustive
  );

/**
 * The toasts of a finished import: whether every question has its correct answer, or that the
 * file held no question, and a note when equations of a Word file were pictures that the teacher
 * types again.
 */
const showFinished = (progress: ImportProgress, id: string) => {
  if (progress.placed === 0) {
    toast.info(
      { description: "import-empty.description", title: "import-empty.title" },
      { id }
    );
    return;
  }
  toast.success(
    progress.keyless === 0
      ? { description: "import-done.description", title: "import-done.title" }
      : {
          description: "import-keyless.description",
          title: "import-keyless.title",
        },
    { id }
  );
  if (progress.mathType > 0) {
    toast.info({
      description: "import-mathtype.description",
      title: "import-mathtype.title",
    });
  }
};

/**
 * The toast of an import that stopped. A refused file names what to do instead. Any other
 * failure is reported, and the toast says whether questions read before it are in the exam.
 */
const showFailed = (
  error: unknown,
  last: Option.Option<ImportProgress>,
  id: string
) =>
  Effect.gen(function* () {
    if (Schema.is(ImportFileRefused)(error)) {
      const key = refusedCopy(error);
      toast.error(
        { description: `${key}.description`, title: `${key}.title` },
        { id }
      );
      return;
    }
    yield* reportClientException(error, {
      source: "components/tenant/exams/import/start",
    });
    toast.error(
      Option.exists(last, (progress) => progress.placed > 0)
        ? {
            description: "import-stopped.description",
            title: "import-stopped.title",
          }
        : {
            description: "import-unread.description",
            title: "import-unread.title",
          },
      { id }
    );
  });

/**
 * Imports a file into a new exam from the browser event that created it. One toast follows the
 * import: it counts the questions placed while Nina reads, and turns into the result when the
 * import ends. The editor shows each read's questions as they are placed, so the teacher checks
 * and corrects them in place, with no step that accepts them.
 */
export function importIntoExam<
  ReadError,
  PlaceError,
  KeysError,
  UrlError,
  RegisterError,
>({
  examId,
  ...calls
}: Omit<
  Parameters<
    typeof runImport<ReadError, PlaceError, KeysError, UrlError, RegisterError>
  >[0],
  "onProgress"
> & { examId: string }) {
  const id = `exam-import-${examId}`;
  const last = MutableRef.make(Option.none<ImportProgress>());
  return runImport({
    ...calls,
    onProgress: (progress) => {
      MutableRef.set(last, Option.some(progress));
      toast.info(
        {
          description: "import-reading.description",
          title: "import-reading.title",
        },
        { duration: UNTIL_REPLACED, id }
      );
    },
  }).pipe(
    Effect.matchEffect({
      onFailure: (error) => showFailed(error, MutableRef.get(last), id),
      onSuccess: (progress) => Effect.sync(() => showFinished(progress, id)),
    })
  );
}
