import { beforeEach, describe, expect, it } from "@effect/vitest";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Data, Effect } from "effect";
import { ImportFileRefused } from "@/components/tenant/exams/import/file";
import type { ImportProgress } from "@/components/tenant/exams/import/run";
import { runImport } from "@/components/tenant/exams/import/run";
import { importIntoExam } from "@/components/tenant/exams/import/start";
import { reportClientException } from "@/lib/analytics/client";

vi.mock("@repo/design-system/lib/toast/notify", () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));
vi.mock("@/lib/analytics/client", async () => {
  const { Effect: Fx } = await import("effect");
  return { reportClientException: vi.fn(() => Fx.void) };
});
vi.mock("@/components/tenant/exams/import/run", () => ({
  runImport: vi.fn(),
}));

/** The progress of an import that placed `placed` questions, `keyless` of them without a key. */
const progressOf = (fields: Partial<ImportProgress> = {}): ImportProgress => ({
  done: 1,
  keyless: 0,
  left: 0,
  mathType: 0,
  placed: 3,
  total: 1,
  ...fields,
});

/** A read that Nina could not answer, as the read action fails with it. */
class ReadFailed extends Data.TaggedError("ImportUnread")<
  Record<never, never>
> {}

/** Makes the next import report `seen` as its progress, then end with `end`. */
const importReports = (
  seen: readonly ImportProgress[],
  end: Effect.Effect<ImportProgress, ImportFileRefused | ReadFailed>
) =>
  vi.mocked(runImport).mockImplementation(({ onProgress }) =>
    Effect.sync(() => {
      for (const progress of seen) {
        onProgress(progress);
      }
    }).pipe(Effect.andThen(end))
  );

/** Imports a file into exam `exam-1` with calls that the mocked runner never makes. */
const importFile = () =>
  importIntoExam({
    examId: "exam-1",
    file: new Blob(["%PDF-1.7"]),
    keys: vi.fn(),
    place: vi.fn(),
    read: vi.fn(),
    register: vi.fn(),
    requestUrl: vi.fn(),
  });

describe("importIntoExam", () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
    vi.mocked(toast.info).mockClear();
    vi.mocked(toast.success).mockClear();
  });

  it.effect(
    "keeps one toast while Nina reads, and turns it into the result when every question has its key",
    () =>
      Effect.gen(function* () {
        importReports(
          [progressOf({ done: 0, placed: 0 })],
          Effect.succeed(progressOf())
        );
        yield* importFile();
        expect(toast.info).toHaveBeenCalledWith(
          {
            description: "import-reading.description",
            title: "import-reading.title",
          },
          { duration: Number.POSITIVE_INFINITY, id: "exam-import-exam-1" }
        );
        expect(toast.success).toHaveBeenCalledWith(
          {
            description: "import-done.description",
            title: "import-done.title",
          },
          { id: "exam-import-exam-1" }
        );
      })
  );

  it.effect(
    "asks for the missing keys, and for equations that were pictures",
    () =>
      Effect.gen(function* () {
        importReports(
          [],
          Effect.succeed(progressOf({ keyless: 2, mathType: 1 }))
        );
        yield* importFile();
        expect(toast.success).toHaveBeenCalledWith(
          {
            description: "import-keyless.description",
            title: "import-keyless.title",
          },
          { id: "exam-import-exam-1" }
        );
        expect(toast.info).toHaveBeenCalledWith({
          description: "import-mathtype.description",
          title: "import-mathtype.title",
        });
      })
  );

  it.effect("says when the file held no question", () =>
    Effect.gen(function* () {
      importReports([], Effect.succeed(progressOf({ placed: 0 })));
      yield* importFile();
      expect(toast.info).toHaveBeenCalledWith(
        {
          description: "import-empty.description",
          title: "import-empty.title",
        },
        { id: "exam-import-exam-1" }
      );
      expect(toast.success).not.toHaveBeenCalled();
    })
  );

  it.effect.each(["type", "size", "pages", "macro", "encrypted"] as const)(
    "names what to do with a file the browser refused for its %s",
    (reason) =>
      Effect.gen(function* () {
        importReports([], Effect.fail(new ImportFileRefused({ reason })));
        yield* importFile();
        expect(toast.error).toHaveBeenCalledWith(
          {
            description: `import-${reason}.description`,
            title: `import-${reason}.title`,
          },
          { id: "exam-import-exam-1" }
        );
      })
  );

  it.effect(
    "reports a failed read, and says whether questions read before it are in the exam",
    () =>
      Effect.gen(function* () {
        importReports(
          [progressOf({ placed: 4 })],
          Effect.fail(new ReadFailed())
        );
        yield* importFile();
        importReports([], Effect.fail(new ReadFailed()));
        yield* importFile();
        expect(reportClientException).toHaveBeenCalledTimes(2);
        expect(vi.mocked(toast.error).mock.calls).toEqual([
          [
            {
              description: "import-stopped.description",
              title: "import-stopped.title",
            },
            { id: "exam-import-exam-1" },
          ],
          [
            {
              description: "import-unread.description",
              title: "import-unread.title",
            },
            { id: "exam-import-exam-1" },
          ],
        ]);
      })
  );
});
