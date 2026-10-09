// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { encodePrettyJsonText } from "@repo/utilities/json";
import {
  Array as Arr,
  DateTime,
  Effect,
  FileSystem,
  Layer,
  MutableList,
  Option,
  Path,
  PlatformError,
} from "effect";
import { TestClock } from "effect/testing";
import { IndexNowSubmitError } from "@/scripts/indexing/errors";
import { recordLogs } from "@/scripts/indexing/fixture";
import {
  ensureSubmissionHistoryFolder,
  listUnsubmittedUrls,
  loadSubmissionHistory,
  saveAcceptedUrls,
  saveSubmissionHistory,
  updateSubmissionHistory,
} from "@/scripts/indexing/history";
import { indexingFiles } from "@/scripts/indexing/paths";

const FIRST = "https://nakafa.com/id/first";
const SECOND = "https://nakafa.com/id/second";
const THIRD = "https://nakafa.com/id/third";
const FOURTH = "https://nakafa.com/id/fourth";
const STAMP = "2026-10-09T08:30:00.000Z";
const EARLIER_STAMP = "2026-01-01T00:00:00.000Z";
const STAMP_MILLIS = DateTime.toEpochMillis(DateTime.makeUnsafe(STAMP));
const EMPTY_HISTORY = { bing: {}, googleIndexingApi: {}, indexNow: {} };
const SAVED_TEXT = `{"bing":{"${FIRST}":"${STAMP}"},"googleIndexingApi":{},"indexNow":{}}`;
const PRETTY_TEXT = Arr.join(
  [
    "{",
    '  "bing": {',
    `    "${FIRST}": "${STAMP}"`,
    "  },",
    '  "googleIndexingApi": {},',
    '  "indexNow": {}',
    "}",
  ],
  "\n"
);

/** The real path service beside a file system scripted for one test. */
const scriptedFiles = (fileSystem: Partial<FileSystem.FileSystem>) =>
  Layer.merge(Path.layer, FileSystem.layerNoop(fileSystem));

/** A failure of one file system method, as the platform reports it. */
const platformFailure = (method: string) =>
  PlatformError.systemError({
    _tag: "PermissionDenied",
    method,
    module: "FileSystem",
  });

/** A file system that refuses every history write. */
const refusedWrites = scriptedFiles({
  writeFileString: () => Effect.fail(platformFailure("writeFileString")),
});

/**
 * A file system whose history writes succeed. Each write is recorded in
 * `events` with its file and text, in the order the module makes it.
 */
const recordWrites = (events: MutableList.MutableList<string>) =>
  scriptedFiles({
    writeFileString: (path, text) =>
      Effect.sync(() => {
        MutableList.append(events, `write ${path} ${text}`);
      }),
  });

describe("loadSubmissionHistory", () => {
  it.effect("returns the empty history when no history file exists", () =>
    Effect.gen(function* () {
      expect(yield* loadSubmissionHistory()).toEqual(EMPTY_HISTORY);
    }).pipe(
      Effect.provide(scriptedFiles({ exists: () => Effect.succeed(false) }))
    )
  );

  it.effect("decodes a valid history file", () =>
    Effect.gen(function* () {
      expect(yield* loadSubmissionHistory()).toEqual({
        bing: { [FIRST]: STAMP },
        googleIndexingApi: {},
        indexNow: {},
      });
    }).pipe(
      Effect.provide(
        scriptedFiles({
          exists: () => Effect.succeed(true),
          readFileString: () => Effect.succeed(SAVED_TEXT),
        })
      )
    )
  );

  it.effect.each([
    { label: "is not JSON", text: "not json" },
    { label: "lacks a service", text: '{"bing":{},"indexNow":{}}' },
    {
      label: "holds a stamp that is not text",
      text: `{"bing":{},"googleIndexingApi":{},"indexNow":{"${FIRST}":1}}`,
    },
  ])(
    "fails with SubmissionHistoryError, never an empty history, when the file $label",
    ({ text }) =>
      Effect.gen(function* () {
        const { submissionHistory } = yield* indexingFiles;

        const error = yield* loadSubmissionHistory().pipe(Effect.flip);

        expect(error).toMatchObject({
          _tag: "SubmissionHistoryError",
          message: `Failed to decode ${submissionHistory}.`,
        });
      }).pipe(
        Effect.provide(
          scriptedFiles({
            exists: () => Effect.succeed(true),
            readFileString: () => Effect.succeed(text),
          })
        )
      )
  );

  it.effect.each([
    {
      files: scriptedFiles({
        exists: () => Effect.fail(platformFailure("exists")),
      }),
      step: "inspect",
    },
    {
      files: scriptedFiles({
        exists: () => Effect.succeed(true),
        readFileString: () => Effect.fail(platformFailure("readFileString")),
      }),
      step: "read",
    },
  ])(
    "fails with SubmissionHistoryError when the file system refuses to $step the history file",
    ({ files, step }) =>
      Effect.gen(function* () {
        const { submissionHistory } = yield* indexingFiles;

        const error = yield* loadSubmissionHistory().pipe(Effect.flip);

        expect(error).toMatchObject({
          _tag: "SubmissionHistoryError",
          message: `Failed to ${step} ${submissionHistory}.`,
        });
      }).pipe(Effect.provide(files))
  );
});

describe("ensureSubmissionHistoryFolder", () => {
  it.effect("creates the state folder when it is missing", () => {
    const makeDirectory = vi.fn<FileSystem.FileSystem["makeDirectory"]>(
      () => Effect.void
    );
    return Effect.gen(function* () {
      const { stateFolder } = yield* indexingFiles;

      yield* ensureSubmissionHistoryFolder();

      expect(makeDirectory).toHaveBeenCalledOnce();
      expect(makeDirectory).toHaveBeenCalledWith(stateFolder, {
        recursive: true,
      });
    }).pipe(
      Effect.provide(
        scriptedFiles({
          exists: () => Effect.succeed(false),
          makeDirectory,
        })
      )
    );
  });

  it.effect("leaves an existing state folder alone", () => {
    const makeDirectory = vi.fn<FileSystem.FileSystem["makeDirectory"]>(
      () => Effect.void
    );
    return Effect.gen(function* () {
      yield* ensureSubmissionHistoryFolder();

      expect(makeDirectory).not.toHaveBeenCalled();
    }).pipe(
      Effect.provide(
        scriptedFiles({
          exists: () => Effect.succeed(true),
          makeDirectory,
        })
      )
    );
  });

  it.effect.each([
    {
      files: scriptedFiles({
        exists: () => Effect.fail(platformFailure("exists")),
      }),
      step: "inspect",
    },
    {
      files: scriptedFiles({
        exists: () => Effect.succeed(false),
        makeDirectory: () => Effect.fail(platformFailure("makeDirectory")),
      }),
      step: "create",
    },
  ])(
    "fails with SubmissionHistoryError when the file system refuses to $step the state folder",
    ({ files, step }) =>
      Effect.gen(function* () {
        const { stateFolder } = yield* indexingFiles;

        const error = yield* ensureSubmissionHistoryFolder().pipe(Effect.flip);

        expect(error).toMatchObject({
          _tag: "SubmissionHistoryError",
          message: `Failed to ${step} ${stateFolder}.`,
        });
      }).pipe(Effect.provide(files))
  );
});

describe("saveSubmissionHistory", () => {
  it.effect(
    "writes the history as two-space JSON text to the history file",
    () => {
      const writeFileString = vi.fn<FileSystem.FileSystem["writeFileString"]>(
        () => Effect.void
      );
      return Effect.gen(function* () {
        const { submissionHistory } = yield* indexingFiles;

        yield* saveSubmissionHistory({
          bing: { [FIRST]: STAMP },
          googleIndexingApi: {},
          indexNow: {},
        });

        expect(writeFileString).toHaveBeenCalledOnce();
        expect(writeFileString).toHaveBeenCalledWith(
          submissionHistory,
          PRETTY_TEXT
        );
      }).pipe(Effect.provide(scriptedFiles({ writeFileString })));
    }
  );

  it.effect(
    "fails with SubmissionHistoryError when the history write fails",
    () =>
      Effect.gen(function* () {
        const { submissionHistory } = yield* indexingFiles;

        const error = yield* saveSubmissionHistory(EMPTY_HISTORY).pipe(
          Effect.flip
        );

        expect(error).toMatchObject({
          _tag: "SubmissionHistoryError",
          message: `Failed to write ${submissionHistory}.`,
        });
      }).pipe(Effect.provide(refusedWrites))
  );
});

describe("listUnsubmittedUrls", () => {
  it("keeps the input order and drops only the URLs this service already has", () => {
    const history = {
      bing: { [SECOND]: STAMP },
      googleIndexingApi: { [THIRD]: STAMP },
      indexNow: { [FIRST]: STAMP },
    };

    expect(
      listUnsubmittedUrls({
        history,
        service: "bing",
        urls: [THIRD, FIRST, SECOND, FOURTH],
      })
    ).toEqual([THIRD, FIRST, FOURTH]);
  });

  it("drops a URL whose history entry is empty text, because the entry still records it", () => {
    const history = {
      bing: { [FIRST]: "" },
      googleIndexingApi: {},
      indexNow: {},
    };

    expect(
      listUnsubmittedUrls({ history, service: "bing", urls: [FIRST, SECOND] })
    ).toEqual([SECOND]);
  });
});

describe("updateSubmissionHistory", () => {
  it.effect(
    "stamps each URL with the clock time as ISO text and leaves the other services untouched",
    () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(STAMP_MILLIS);
        const history = {
          bing: { [FIRST]: EARLIER_STAMP },
          googleIndexingApi: { [SECOND]: EARLIER_STAMP },
          indexNow: {},
        };

        const updated = yield* updateSubmissionHistory({
          history,
          service: "bing",
          urls: [FIRST, THIRD],
        });

        expect(updated).toEqual({
          bing: { [FIRST]: STAMP, [THIRD]: STAMP },
          googleIndexingApi: { [SECOND]: EARLIER_STAMP },
          indexNow: {},
        });
        expect(history.bing).toEqual({ [FIRST]: EARLIER_STAMP });
      })
  );
});

describe("saveAcceptedUrls", () => {
  it.effect(
    "saves the accepted URLs once and returns the new history when nothing failed",
    () => {
      const events = MutableList.make<string>();
      return Effect.gen(function* () {
        yield* TestClock.setTime(STAMP_MILLIS);
        const { submissionHistory } = yield* indexingFiles;

        const updated = yield* saveAcceptedUrls({
          failure: Option.none(),
          history: EMPTY_HISTORY,
          service: "indexNow",
          submittedUrls: [FIRST, SECOND],
        });

        expect(updated).toEqual({
          bing: {},
          googleIndexingApi: {},
          indexNow: { [FIRST]: STAMP, [SECOND]: STAMP },
        });
        expect(MutableList.toArray(events)).toEqual([
          `write ${submissionHistory} ${encodePrettyJsonText(updated)}`,
        ]);
      }).pipe(Effect.provide(recordWrites(events)));
    }
  );

  it.effect(
    "saves the accepted URLs first, then raises the same typed failure that ended the call",
    () => {
      const events = MutableList.make<string>();
      const failure = new IndexNowSubmitError({
        cause: 500,
        message: "IndexNow batch 2 failed with HTTP 500.",
      });
      return Effect.gen(function* () {
        yield* TestClock.setTime(STAMP_MILLIS);
        const { submissionHistory } = yield* indexingFiles;

        const raised = yield* saveAcceptedUrls({
          failure: Option.some(failure),
          history: EMPTY_HISTORY,
          service: "indexNow",
          submittedUrls: [FIRST],
        }).pipe(Effect.flip);
        // The caller sees the failure only after the write has run.
        MutableList.append(events, "raised");

        expect(raised).toBe(failure);
        expect(MutableList.toArray(events)).toEqual([
          `write ${submissionHistory} ${encodePrettyJsonText({
            bing: {},
            googleIndexingApi: {},
            indexNow: { [FIRST]: STAMP },
          })}`,
          "raised",
        ]);
      }).pipe(Effect.provide(recordWrites(events)));
    }
  );

  it.effect(
    "saves nothing and raises the failure when no URL was accepted",
    () => {
      const events = MutableList.make<string>();
      const failure = new IndexNowSubmitError({
        cause: 500,
        message: "IndexNow batch 1 failed with HTTP 500.",
      });
      return Effect.gen(function* () {
        const raised = yield* saveAcceptedUrls({
          failure: Option.some(failure),
          history: EMPTY_HISTORY,
          service: "indexNow",
          submittedUrls: [],
        }).pipe(Effect.flip);
        MutableList.append(events, "raised");

        expect(raised).toBe(failure);
        expect(MutableList.toArray(events)).toEqual(["raised"]);
      }).pipe(Effect.provide(recordWrites(events)));
    }
  );

  it.effect(
    "saves nothing and returns the same history when nothing failed and no URL was accepted",
    () => {
      const events = MutableList.make<string>();
      const history = {
        bing: { [FIRST]: EARLIER_STAMP },
        googleIndexingApi: {},
        indexNow: {},
      };
      return Effect.gen(function* () {
        const returned = yield* saveAcceptedUrls({
          failure: Option.none(),
          history,
          service: "bing",
          submittedUrls: [],
        });

        expect(returned).toBe(history);
        expect(MutableList.toArray(events)).toEqual([]);
      }).pipe(Effect.provide(recordWrites(events)));
    }
  );

  it.effect(
    "fails with SubmissionHistoryError when the write of accepted URLs fails",
    () =>
      Effect.gen(function* () {
        const { submissionHistory } = yield* indexingFiles;

        const error = yield* saveAcceptedUrls({
          failure: Option.none(),
          history: EMPTY_HISTORY,
          service: "bing",
          submittedUrls: [FIRST],
        }).pipe(Effect.flip);

        expect(error).toMatchObject({
          _tag: "SubmissionHistoryError",
          message: `Failed to write ${submissionHistory}.`,
        });
      }).pipe(Effect.provide(refusedWrites))
  );

  it.effect(
    "logs the service failure and raises the history write failure when both occur",
    () => {
      const lines = MutableList.make<string>();
      const failure = new IndexNowSubmitError({
        cause: 500,
        message: "IndexNow batch 1 failed with HTTP 500.",
      });
      return Effect.gen(function* () {
        const { submissionHistory } = yield* indexingFiles;

        const error = yield* saveAcceptedUrls({
          failure: Option.some(failure),
          history: EMPTY_HISTORY,
          service: "indexNow",
          submittedUrls: [FIRST],
        }).pipe(Effect.flip);

        expect(error).toMatchObject({
          _tag: "SubmissionHistoryError",
          message: `Failed to write ${submissionHistory}.`,
        });
        expect(MutableList.toArray(lines)).toContain(failure.message);
      }).pipe(Effect.provide(Layer.mergeAll(refusedWrites, recordLogs(lines))));
    }
  );
});
