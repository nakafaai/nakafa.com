import { Effect } from "effect";
import { GoogleIndexSubmitError } from "@/scripts/indexing/errors";
import { getGoogleAccessToken } from "@/scripts/indexing/google/auth";
import { getEligibleGoogleIndexingUrls } from "@/scripts/indexing/google/eligibility";
import { submitUrlsToGoogle } from "@/scripts/indexing/google/submit";
import {
  ensureSubmissionHistoryFolder,
  listUnsubmittedUrls,
  loadSubmissionHistory,
  type SubmissionHistory,
  saveSubmissionHistory,
  updateSubmissionHistory,
} from "@/scripts/indexing/history";
import {
  forEachSiteIndexUrlBatch,
  type SiteIndexManifestSummary,
} from "@/scripts/indexing/manifest";
import { INDEXING_HOST } from "@/scripts/indexing/paths";
import { logger } from "@/scripts/utils";

const RATE_LIMIT_DELAY = 1000;
const PERCENTAGE_MULTIPLIER = 100;
const SUCCESS_RATE_THRESHOLD = 50;

/**
 * Runs the policy-safe Google Indexing API notification flow.
 *
 * The manifest still proves all canonical Nakafa URLs are discoverable through
 * sitemap/canonical/Search Console paths. This runner only authenticates and
 * writes ignored history after live JSON-LD proves URL-level Indexing API
 * eligibility under Google's JobPosting/BroadcastEvent policy.
 */
export const runGoogleIndexing = Effect.fn("scripts.indexing.google.run")(
  function* () {
    yield* Effect.sync(() => {
      logger.header("Starting Google Indexing API Eligibility Check");
    });

    let accessToken: string | undefined;
    let history: SubmissionHistory | undefined;
    let queuedCount = 0;
    let successfullySubmittedCount = 0;
    const summary = yield* forEachSiteIndexUrlBatch((batch) =>
      Effect.gen(function* () {
        const eligibleUrls = yield* getEligibleGoogleIndexingUrls(batch);

        if (eligibleUrls.length === 0) {
          return;
        }

        if (!history) {
          yield* ensureSubmissionHistoryFolder();
          history = yield* loadSubmissionHistory();
        }

        const urls = listUnsubmittedUrls({
          history,
          service: "googleIndexingApi",
          urls: eligibleUrls,
        });

        logger.stats(
          "Previously submitted eligible URLs to Google",
          Object.keys(history.googleIndexingApi).length
        );
        logger.stats(
          `New eligible URLs to submit to Google in batch ${batch.batchIndex}`,
          urls.length
        );

        if (urls.length === 0) {
          return;
        }

        if (!accessToken) {
          accessToken = yield* getGoogleAccessToken();
          logger.stats("Google service account", "Authenticated successfully");
          logger.stats("Website URL", INDEXING_HOST);
          logger.stats("Rate limit delay", `${RATE_LIMIT_DELAY}ms`);
        }

        queuedCount += urls.length;

        const successfullySubmitted = yield* submitUrlsToGoogle(
          urls,
          accessToken
        );
        successfullySubmittedCount += successfullySubmitted.length;

        if (successfullySubmitted.length === 0) {
          return;
        }

        history = updateSubmissionHistory({
          history,
          service: "googleIndexingApi",
          urls: successfullySubmitted,
        });
        yield* saveSubmissionHistory(history);
      })
    );

    logManifestSummary(summary);

    if (!history) {
      logger.info(
        "No Google Indexing API eligible URLs were found in current sitemap pages."
      );
      logger.info(
        "This does not reduce Google discoverability: Nakafa's general public pages remain discoverable through sitemap.xml, sitemap shards, robots.txt, canonical metadata, and Search Console."
      );
      logger.header("Google Indexing API Eligibility Check Completed");
      return;
    }

    if (queuedCount === 0) {
      logger.info(
        "All Google Indexing API eligible URLs were already submitted."
      );
      logger.header("Google Indexing API Eligibility Check Completed");
      return;
    }

    const successRate = Math.round(
      (successfullySubmittedCount / queuedCount) * PERCENTAGE_MULTIPLIER
    );

    logger.info("Final Google Indexing API results:");
    logger.info(`Total eligible URLs queued: ${queuedCount}`);
    logger.info(`Successfully submitted: ${successfullySubmittedCount}`);
    logger.info(
      `Rejected or skipped: ${queuedCount - successfullySubmittedCount}`
    );
    logger.info(`Success rate: ${successRate}%`);

    if (successRate < SUCCESS_RATE_THRESHOLD) {
      logger.warn(
        "Low success rate indicates Google API rate limiting or errors."
      );
    }

    if (successfullySubmittedCount === 0) {
      return yield* Effect.fail(
        new GoogleIndexSubmitError({
          cause: "No eligible URLs were successfully submitted.",
          message: "Google Indexing API submission submitted zero queued URLs.",
        })
      );
    }

    logger.header("Google Indexing API Submission Process Completed");
  }
);

/** Reports sitemap coverage processed before Google API eligibility checks. */
function logManifestSummary(summary: SiteIndexManifestSummary) {
  logger.stats("Google sitemap batches processed", summary.batchCount);
  logger.stats("Google sitemap entries inspected", summary.totalEntryCount);
  logger.stats("Google canonical URLs inspected", summary.canonicalUrlCount);
  logger.stats("Google duplicate URLs skipped", summary.duplicateCount);
}
