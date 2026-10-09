import { encodePrettyJsonText } from "@repo/utilities/json";
import { Clock, Effect, FileSystem, Schema } from "effect";
import { SubmissionHistoryError } from "@/scripts/indexing/errors";
import { indexingFiles } from "@/scripts/indexing/paths";

const SubmissionServiceSchema = Schema.Literals([
  "bing",
  "googleIndexingApi",
  "indexNow",
]);
const ServiceHistorySchema = Schema.Record(Schema.String, Schema.String);
const SubmissionHistorySchema = Schema.Struct({
  bing: ServiceHistorySchema,
  googleIndexingApi: ServiceHistorySchema,
  indexNow: ServiceHistorySchema,
});
const decodeSubmissionHistory = Schema.decodeUnknownEffect(
  Schema.fromJsonString(SubmissionHistorySchema)
);
const decodeEmptySubmissionHistory = Schema.decodeUnknownEffect(
  SubmissionHistorySchema
);
export type SubmissionHistory = typeof SubmissionHistorySchema.Type;
export type SubmissionService = typeof SubmissionServiceSchema.Type;
/** Builds an empty local submission-history value for a first script run. */
export function emptySubmissionHistory(): SubmissionHistory {
  return {
    bing: {},
    googleIndexingApi: {},
    indexNow: {},
  };
}
/** Ensures the ignored local state folder exists before an adapter writes history. */
export const ensureSubmissionHistoryFolder = Effect.fn(
  "scripts.indexing.history.ensureFolder"
)(function* () {
  const fs = yield* FileSystem.FileSystem;
  const { stateFolder } = yield* indexingFiles;
  const exists = yield* fs.exists(stateFolder).pipe(
    Effect.mapError(
      (cause) =>
        new SubmissionHistoryError({
          cause,
          message: `Failed to inspect ${stateFolder}.`,
        })
    )
  );
  if (exists) {
    return;
  }
  yield* fs.makeDirectory(stateFolder, { recursive: true }).pipe(
    Effect.mapError(
      (cause) =>
        new SubmissionHistoryError({
          cause,
          message: `Failed to create ${stateFolder}.`,
        })
    )
  );
  yield* Effect.logInfo(`Created script state folder at: ${stateFolder}`);
});
/**
 * Loads ignored submission history for IndexNow, Bing, and Google adapters.
 *
 * A malformed history file fails loudly because it only affects local script
 * state and should never change sitemap/public indexing coverage.
 */
export const loadSubmissionHistory = Effect.fn("scripts.indexing.history.load")(
  function* () {
    const fs = yield* FileSystem.FileSystem;
    const { submissionHistory } = yield* indexingFiles;
    const exists = yield* fs.exists(submissionHistory).pipe(
      Effect.mapError(
        (cause) =>
          new SubmissionHistoryError({
            cause,
            message: `Failed to inspect ${submissionHistory}.`,
          })
      )
    );
    if (!exists) {
      return yield* decodeEmptySubmissionHistory(emptySubmissionHistory());
    }
    const data = yield* fs.readFileString(submissionHistory).pipe(
      Effect.mapError(
        (cause) =>
          new SubmissionHistoryError({
            cause,
            message: `Failed to read ${submissionHistory}.`,
          })
      )
    );
    return yield* decodeSubmissionHistory(data).pipe(
      Effect.mapError(
        (cause) =>
          new SubmissionHistoryError({
            cause,
            message: `Failed to decode ${submissionHistory}.`,
          })
      )
    );
  }
);
/** Persists ignored local submission history after successful notifications. */
export const saveSubmissionHistory = Effect.fn("scripts.indexing.history.save")(
  function* (history: SubmissionHistory) {
    const fs = yield* FileSystem.FileSystem;
    const { submissionHistory } = yield* indexingFiles;
    const text = encodePrettyJsonText(history);
    yield* fs.writeFileString(submissionHistory, text).pipe(
      Effect.mapError(
        (cause) =>
          new SubmissionHistoryError({
            cause,
            message: `Failed to write ${submissionHistory}.`,
          })
      )
    );
  }
);
/**
 * Returns canonical URLs that a specific adapter has not successfully notified.
 *
 * The input URL list comes from the sitemap manifest, so adapters cannot drift
 * into source-of-truth route registries or hidden manual URL lists.
 */
export function listUnsubmittedUrls({
  history,
  service,
  urls,
}: {
  history: SubmissionHistory;
  service: SubmissionService;
  urls: readonly string[];
}) {
  return urls.filter((url) => !history[service][url]);
}
/** Adds successful notifications to one service's ignored local history. */
export const updateSubmissionHistory = Effect.fn(
  "scripts.indexing.history.update"
)(function* ({
  history,
  service,
  urls,
}: {
  history: SubmissionHistory;
  service: SubmissionService;
  urls: readonly string[];
}) {
  const timestamp = new Date(yield* Clock.currentTimeMillis).toISOString();
  const serviceHistory = { ...history[service] };
  for (const url of urls) {
    serviceHistory[url] = timestamp;
  }
  return {
    ...history,
    [service]: serviceHistory,
  };
});
