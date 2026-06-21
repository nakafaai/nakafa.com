import fs from "node:fs";
import { Effect, Schema } from "effect";
import { SubmissionHistoryError } from "@/scripts/indexing/errors";
import {
  INDEXING_STATE_FOLDER,
  SUBMISSION_HISTORY_FILE,
} from "@/scripts/indexing/paths";
import { logger } from "@/scripts/utils";

const SubmissionServiceSchema = Schema.Literal(
  "bing",
  "googleIndexingApi",
  "indexNow"
);
const ServiceHistorySchema = Schema.Record({
  key: Schema.String,
  value: Schema.String,
});
const SubmissionHistorySchema = Schema.Struct({
  bing: ServiceHistorySchema,
  googleIndexingApi: ServiceHistorySchema,
  indexNow: ServiceHistorySchema,
});
const decodeSubmissionHistory = Schema.decodeUnknown(
  Schema.parseJson(SubmissionHistorySchema)
);
const decodeEmptySubmissionHistory = Schema.decodeUnknown(
  SubmissionHistorySchema
);

export type SubmissionHistory = Schema.Schema.Type<
  typeof SubmissionHistorySchema
>;
export type SubmissionService = Schema.Schema.Type<
  typeof SubmissionServiceSchema
>;

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
  const exists = yield* Effect.try({
    catch: (cause) =>
      new SubmissionHistoryError({
        cause,
        message: `Failed to inspect ${INDEXING_STATE_FOLDER}.`,
      }),
    try: () => fs.existsSync(INDEXING_STATE_FOLDER),
  });

  if (exists) {
    return;
  }

  yield* Effect.try({
    catch: (cause) =>
      new SubmissionHistoryError({
        cause,
        message: `Failed to create ${INDEXING_STATE_FOLDER}.`,
      }),
    try: () => {
      fs.mkdirSync(INDEXING_STATE_FOLDER, { recursive: true });
      logger.info(`Created script state folder at: ${INDEXING_STATE_FOLDER}`);
    },
  });
});

/**
 * Loads ignored submission history for IndexNow, Bing, and Google adapters.
 *
 * A malformed history file fails loudly because it only affects local script
 * state and should never change sitemap/public indexing coverage.
 */
export const loadSubmissionHistory = Effect.fn("scripts.indexing.history.load")(
  function* () {
    const exists = yield* Effect.try({
      catch: (cause) =>
        new SubmissionHistoryError({
          cause,
          message: `Failed to inspect ${SUBMISSION_HISTORY_FILE}.`,
        }),
      try: () => fs.existsSync(SUBMISSION_HISTORY_FILE),
    });

    if (!exists) {
      return yield* decodeEmptySubmissionHistory(emptySubmissionHistory());
    }

    const data = yield* Effect.try({
      catch: (cause) =>
        new SubmissionHistoryError({
          cause,
          message: `Failed to read ${SUBMISSION_HISTORY_FILE}.`,
        }),
      try: () => fs.readFileSync(SUBMISSION_HISTORY_FILE, "utf8"),
    });

    return yield* decodeSubmissionHistory(data).pipe(
      Effect.mapError(
        (cause) =>
          new SubmissionHistoryError({
            cause,
            message: `Failed to decode ${SUBMISSION_HISTORY_FILE}.`,
          })
      )
    );
  }
);

/** Persists ignored local submission history after successful notifications. */
export const saveSubmissionHistory = Effect.fn("scripts.indexing.history.save")(
  function* (history: SubmissionHistory) {
    yield* Effect.try({
      catch: (cause) =>
        new SubmissionHistoryError({
          cause,
          message: `Failed to write ${SUBMISSION_HISTORY_FILE}.`,
        }),
      try: () => {
        fs.writeFileSync(
          SUBMISSION_HISTORY_FILE,
          JSON.stringify(history, null, 2),
          "utf8"
        );
      },
    });
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
export function updateSubmissionHistory({
  history,
  service,
  urls,
}: {
  history: SubmissionHistory;
  service: SubmissionService;
  urls: readonly string[];
}): SubmissionHistory {
  const timestamp = new Date().toISOString();
  const serviceHistory = { ...history[service] };

  for (const url of urls) {
    serviceHistory[url] = timestamp;
  }

  return {
    ...history,
    [service]: serviceHistory,
  };
}
