import { Effect } from "effect";
import { GoogleIndexSubmitError } from "@/scripts/indexing/errors";
import { getGoogleAccessToken } from "@/scripts/indexing/google/auth";
import { getEligibleGoogleIndexingUrls } from "@/scripts/indexing/google/eligibility";
import { submitUrlsToGoogle } from "@/scripts/indexing/google/submit";
import {
  ensureSubmissionHistoryFolder,
  listUnsubmittedUrls,
  loadSubmissionHistory,
  saveSubmissionHistory,
  updateSubmissionHistory,
} from "@/scripts/indexing/history";
import { getSiteIndexManifest } from "@/scripts/indexing/manifest";
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

    const manifest = yield* getSiteIndexManifest();
    const eligibleUrls = yield* getEligibleGoogleIndexingUrls(manifest);

    if (eligibleUrls.length === 0) {
      logger.info(
        "No Google Indexing API eligible URLs were found in current sitemap pages."
      );
      logger.info(
        "This does not reduce Google discoverability: Nakafa's general public pages remain discoverable through sitemap.xml, sitemap shards, robots.txt, canonical metadata, and Search Console."
      );
      logger.header("Google Indexing API Eligibility Check Completed");
      return;
    }

    yield* ensureSubmissionHistoryFolder();
    const history = yield* loadSubmissionHistory();
    const urls = listUnsubmittedUrls({
      history,
      service: "googleIndexingApi",
      urls: eligibleUrls,
    });

    logger.stats(
      "Previously submitted eligible URLs to Google",
      Object.keys(history.googleIndexingApi).length
    );
    logger.stats("New eligible URLs to submit to Google", urls.length);

    if (urls.length === 0) {
      logger.info(
        "All Google Indexing API eligible URLs were already submitted."
      );
      logger.header("Google Indexing API Eligibility Check Completed");
      return;
    }

    const accessToken = yield* getGoogleAccessToken();

    logger.stats("Google service account", "Authenticated successfully");
    logger.stats("Website URL", INDEXING_HOST);
    logger.stats("Rate limit delay", `${RATE_LIMIT_DELAY}ms`);

    const successfullySubmitted = yield* submitUrlsToGoogle(urls, accessToken);

    if (successfullySubmitted.length > 0) {
      const updatedHistory = updateSubmissionHistory({
        history,
        service: "googleIndexingApi",
        urls: successfullySubmitted,
      });
      yield* saveSubmissionHistory(updatedHistory);
    }

    const successRate = Math.round(
      (successfullySubmitted.length / urls.length) * PERCENTAGE_MULTIPLIER
    );

    logger.info("Final Google Indexing API results:");
    logger.info(`Total eligible URLs queued: ${urls.length}`);
    logger.info(`Successfully submitted: ${successfullySubmitted.length}`);
    logger.info(
      `Rejected or skipped: ${urls.length - successfullySubmitted.length}`
    );
    logger.info(`Success rate: ${successRate}%`);

    if (successRate < SUCCESS_RATE_THRESHOLD) {
      logger.warn(
        "Low success rate indicates Google API rate limiting or errors."
      );
    }

    if (successfullySubmitted.length === 0) {
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
