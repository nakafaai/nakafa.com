import { Effect } from "effect";
import {
  ensureSubmissionHistoryFolder,
  listUnsubmittedUrls,
  loadSubmissionHistory,
  type SubmissionHistory,
  saveSubmissionHistory,
  updateSubmissionHistory,
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
import { logger } from "@/scripts/utils";

/**
 * Runs sitemap-derived URL notifications for IndexNow and Bing.
 *
 * Sitemap entries remain the canonical discovery source. This runner filters
 * already-submitted URLs, invokes supported adapters, and records successful
 * notifications in ignored local history.
 */
export const runIndexNow = Effect.fn("scripts.indexing.indexNow.run")(
  function* () {
    logger.header("Starting URL Submission Process");

    logger.stats("Website URL", INDEXING_HOST);
    logger.stats("Host URL", INDEXING_HOSTNAME);
    logger.stats("IndexNow key file location", INDEXNOW_KEY_LOCATION);

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

    logManifestSummary("IndexNow", indexNowSummary);
    yield* runBingSubmission(history);

    logger.header("Submission Process Completed");
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
  logger.header("IndexNow Submission");

  const unsubmittedUrls = listUnsubmittedUrls({
    history,
    service: "indexNow",
    urls,
  });

  logger.stats(
    "Previously submitted URLs to IndexNow",
    Object.keys(history.indexNow).length
  );
  logger.stats(
    `New URLs to submit to IndexNow in batch ${batchIndex}`,
    unsubmittedUrls.length
  );

  if (unsubmittedUrls.length === 0) {
    logger.info(
      "No new URLs to submit to IndexNow. All canonical URLs have been previously submitted."
    );
    return history;
  }

  const successfulUrls = yield* submitUrlsToIndexNow(
    unsubmittedUrls,
    INDEXNOW_KEY
  );

  if (successfulUrls.length === 0) {
    return history;
  }

  const updatedHistory = updateSubmissionHistory({
    history,
    service: "indexNow",
    urls: successfulUrls,
  });
  yield* saveSubmissionHistory(updatedHistory);
  logger.success(
    `Submission history updated for IndexNow with ${successfulUrls.length} successfully submitted URLs.`
  );

  return updatedHistory;
});

/** Submits canonical URLs to Bing when the optional Webmaster API key exists. */
const runBingSubmission = Effect.fn("scripts.indexing.indexNow.runBing")(
  function* (history: SubmissionHistory) {
    logger.header("Bing URL Submission API");

    const apiKey = yield* readBingWebmasterApiKey();

    if (apiKey === undefined) {
      logger.warn(
        "Bing Webmaster API key not configured. Skipping Bing URL Submission."
      );
      logger.info(
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

    logManifestSummary("Bing", summary);
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

    logger.stats(
      "Previously submitted URLs to Bing",
      Object.keys(history.bing).length
    );
    logger.stats(
      `New URLs to submit to Bing in batch ${batchIndex}`,
      unsubmittedUrls.length
    );

    if (unsubmittedUrls.length === 0) {
      logger.info(
        "No new URLs to submit to Bing. All canonical URLs have been previously submitted."
      );
      return history;
    }

    const successfulUrls = yield* submitUrlsToBing(unsubmittedUrls, apiKey);

    if (successfulUrls.length === 0) {
      return history;
    }

    const updatedHistory = updateSubmissionHistory({
      history,
      service: "bing",
      urls: successfulUrls,
    });
    yield* saveSubmissionHistory(updatedHistory);
    logger.success(
      `Submission history updated for Bing with ${successfulUrls.length} successfully submitted URLs.`
    );

    return updatedHistory;
  }
);

/** Reports sitemap coverage summary after one indexing adapter pass. */
function logManifestSummary(
  service: string,
  summary: SiteIndexManifestSummary
) {
  logger.stats(`${service} sitemap batches processed`, summary.batchCount);
  logger.stats(
    `${service} canonical URLs inspected`,
    summary.canonicalUrlCount
  );
}
