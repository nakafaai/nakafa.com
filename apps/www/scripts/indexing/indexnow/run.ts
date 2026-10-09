import { Effect, Record as Rec } from "effect";
import {
  ensureSubmissionHistoryFolder,
  listUnsubmittedUrls,
  loadSubmissionHistory,
  type SubmissionHistory,
  saveAcceptedUrls,
} from "@/scripts/indexing/history";
import {
  readBingWebmasterApiKey,
  submitUrlsToBing,
} from "@/scripts/indexing/indexnow/bing";
import { submitUrlsToIndexNow } from "@/scripts/indexing/indexnow/submit";
import {
  forEachSiteIndexUrlBatch,
  type SiteIndexManifestSummary,
} from "@/scripts/indexing/manifest";
import {
  INDEXING_HOST,
  INDEXING_HOSTNAME,
  INDEXNOW_KEY,
  INDEXNOW_KEY_LOCATION,
} from "@/scripts/indexing/paths";

/**
 * Runs sitemap-derived URL notifications for IndexNow and Bing.
 *
 * Sitemap entries remain the canonical discovery source. This runner filters
 * already-submitted URLs, invokes supported adapters, and records successful
 * notifications in ignored local history.
 */
export const runIndexNow = Effect.fn("scripts.indexing.indexNow.run")(
  function* () {
    yield* Effect.logInfo("Starting URL Submission Process");

    yield* Effect.logInfo(`Website URL: ${INDEXING_HOST}`);
    yield* Effect.logInfo(`Host URL: ${INDEXING_HOSTNAME}`);
    yield* Effect.logInfo(
      `IndexNow key file location: ${INDEXNOW_KEY_LOCATION}`
    );

    yield* ensureSubmissionHistoryFolder();
    let history = yield* loadSubmissionHistory();
    const indexNowSummary = yield* forEachSiteIndexUrlBatch((batch) =>
      Effect.gen(function* () {
        history = yield* runIndexNowSubmission({
          batchIndex: batch.batchIndex,
          history,
          urls: batch.urls,
        });
      })
    );

    yield* logManifestSummary("IndexNow", indexNowSummary);
    yield* runBingSubmission(history);

    yield* Effect.logInfo("Submission Process Completed");
  }
);

/** Submits canonical URLs to IndexNow and returns history with successes saved. */
const runIndexNowSubmission = Effect.fn(
  "scripts.indexing.indexNow.runIndexNow"
)(function* ({
  batchIndex,
  history,
  urls,
}: {
  batchIndex: number;
  history: SubmissionHistory;
  urls: readonly string[];
}) {
  yield* Effect.logInfo("IndexNow Submission");

  const unsubmittedUrls = listUnsubmittedUrls({
    history,
    service: "indexNow",
    urls,
  });

  yield* Effect.logInfo(
    `Previously submitted URLs to IndexNow: ${Rec.keys(history.indexNow).length}`
  );
  yield* Effect.logInfo(
    `New URLs to submit to IndexNow in batch ${batchIndex}: ${unsubmittedUrls.length}`
  );

  if (unsubmittedUrls.length === 0) {
    yield* Effect.logInfo(
      "No new URLs to submit to IndexNow. All canonical URLs have been previously submitted."
    );
    return history;
  }

  const { failure, submittedUrls } = yield* submitUrlsToIndexNow(
    unsubmittedUrls,
    INDEXNOW_KEY
  );

  return yield* saveAcceptedUrls({
    failure,
    history,
    service: "indexNow",
    submittedUrls,
  });
});

/** Submits canonical URLs to Bing when the optional Webmaster API key exists. */
const runBingSubmission = Effect.fn("scripts.indexing.indexNow.runBing")(
  function* (history: SubmissionHistory) {
    yield* Effect.logInfo("Bing URL Submission API");

    const apiKey = yield* readBingWebmasterApiKey();

    if (apiKey === undefined) {
      yield* Effect.logWarning(
        "Bing Webmaster API key not configured. Skipping Bing URL Submission."
      );
      yield* Effect.logInfo(
        "To enable Bing URL Submission, add BING_WEBMASTER_API_KEY to the local environment."
      );
      return;
    }

    let latestHistory = history;
    const summary = yield* forEachSiteIndexUrlBatch((batch) =>
      Effect.gen(function* () {
        latestHistory = yield* submitBingBatch({
          apiKey,
          batchIndex: batch.batchIndex,
          history: latestHistory,
          urls: batch.urls,
        });
      })
    );

    yield* logManifestSummary("Bing", summary);
  }
);

/** Submits one sitemap URL batch to Bing and returns updated local history. */
const submitBingBatch = Effect.fn("scripts.indexing.indexNow.runBingBatch")(
  function* ({
    apiKey,
    batchIndex,
    history,
    urls,
  }: {
    apiKey: string;
    batchIndex: number;
    history: SubmissionHistory;
    urls: readonly string[];
  }) {
    const unsubmittedUrls = listUnsubmittedUrls({
      history,
      service: "bing",
      urls,
    });

    yield* Effect.logInfo(
      `Previously submitted URLs to Bing: ${Rec.keys(history.bing).length}`
    );
    yield* Effect.logInfo(
      `New URLs to submit to Bing in batch ${batchIndex}: ${unsubmittedUrls.length}`
    );

    if (unsubmittedUrls.length === 0) {
      yield* Effect.logInfo(
        "No new URLs to submit to Bing. All canonical URLs have been previously submitted."
      );
      return history;
    }

    const { failure, submittedUrls } = yield* submitUrlsToBing(
      unsubmittedUrls,
      apiKey
    );

    return yield* saveAcceptedUrls({
      failure,
      history,
      service: "bing",
      submittedUrls,
    });
  }
);

/** Reports sitemap coverage summary after one indexing adapter pass. */
function logManifestSummary(
  service: string,
  summary: SiteIndexManifestSummary
) {
  return Effect.logInfo(
    `${service} sitemap batches processed: ${summary.batchCount}`
  ).pipe(
    Effect.andThen(
      Effect.logInfo(
        `${service} canonical URLs inspected: ${summary.canonicalUrlCount}`
      )
    )
  );
}
