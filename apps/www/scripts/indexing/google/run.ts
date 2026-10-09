import { Effect, Record as Rec } from "effect";
import { GoogleIndexSubmitError } from "@/scripts/indexing/errors";
import { getGoogleAccessToken } from "@/scripts/indexing/google/auth";
import { getEligibleGoogleIndexingUrls } from "@/scripts/indexing/google/eligibility";
import { submitUrlsToGoogle } from "@/scripts/indexing/google/submit";
import {
  ensureSubmissionHistoryFolder,
  listUnsubmittedUrls,
  loadSubmissionHistory,
  type SubmissionHistory,
  saveAcceptedUrls,
} from "@/scripts/indexing/history";
import {
  forEachSiteIndexUrlBatch,
  type SiteIndexManifestSummary,
} from "@/scripts/indexing/manifest";
import { INDEXING_HOST } from "@/scripts/indexing/paths";

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
    yield* Effect.logInfo("Starting Google Indexing API Eligibility Check");

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

        yield* Effect.logInfo(
          `Previously submitted eligible URLs to Google: ${Rec.keys(history.googleIndexingApi).length}`
        );
        yield* Effect.logInfo(
          `New eligible URLs to submit to Google in batch ${batch.batchIndex}: ${urls.length}`
        );

        if (urls.length === 0) {
          return;
        }

        if (!accessToken) {
          accessToken = yield* getGoogleAccessToken();
          yield* Effect.logInfo(
            "Google service account: Authenticated successfully"
          );
          yield* Effect.logInfo(`Website URL: ${INDEXING_HOST}`);
          yield* Effect.logInfo(`Rate limit delay: ${RATE_LIMIT_DELAY}ms`);
        }

        queuedCount += urls.length;

        const { failure, submittedUrls } = yield* submitUrlsToGoogle(
          urls,
          accessToken
        );
        successfullySubmittedCount += submittedUrls.length;

        history = yield* saveAcceptedUrls({
          failure,
          history,
          service: "googleIndexingApi",
          submittedUrls,
        });
      })
    );

    yield* logManifestSummary(summary);

    if (!history) {
      yield* Effect.logInfo(
        "No Google Indexing API eligible URLs were found in current sitemap pages."
      );
      yield* Effect.logInfo(
        "This does not reduce Google discoverability: Nakafa's general public pages remain discoverable through sitemap.xml, sitemap shards, robots.txt, canonical metadata, and Search Console."
      );
      yield* Effect.logInfo("Google Indexing API Eligibility Check Completed");
      return;
    }

    if (queuedCount === 0) {
      yield* Effect.logInfo(
        "All Google Indexing API eligible URLs were already submitted."
      );
      yield* Effect.logInfo("Google Indexing API Eligibility Check Completed");
      return;
    }

    const successRate = Math.round(
      (successfullySubmittedCount / queuedCount) * PERCENTAGE_MULTIPLIER
    );

    yield* Effect.logInfo("Final Google Indexing API results:");
    yield* Effect.logInfo(`Total eligible URLs queued: ${queuedCount}`);
    yield* Effect.logInfo(
      `Successfully submitted: ${successfullySubmittedCount}`
    );
    yield* Effect.logInfo(
      `Rejected or skipped: ${queuedCount - successfullySubmittedCount}`
    );
    yield* Effect.logInfo(`Success rate: ${successRate}%`);

    if (successRate < SUCCESS_RATE_THRESHOLD) {
      yield* Effect.logWarning(
        "Low success rate indicates Google API rate limiting or errors."
      );
    }

    if (successfullySubmittedCount === 0) {
      return yield* GoogleIndexSubmitError.make({
        cause: "No eligible URLs were successfully submitted.",
        message: "Google Indexing API submission submitted zero queued URLs.",
      });
    }

    yield* Effect.logInfo("Google Indexing API Submission Process Completed");
  }
);

/** Reports sitemap coverage processed before Google API eligibility checks. */
function logManifestSummary(summary: SiteIndexManifestSummary) {
  return Effect.logInfo(
    `Google sitemap batches processed: ${summary.batchCount}`
  ).pipe(
    Effect.andThen(
      Effect.logInfo(
        `Google canonical URLs inspected: ${summary.canonicalUrlCount}`
      )
    )
  );
}
