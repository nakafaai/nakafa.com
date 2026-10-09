// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { FetchClient } from "@repo/utilities/http/client";
import { encodePrettyJsonText } from "@repo/utilities/json";
import {
  Array as Arr,
  Effect,
  type FileSystem,
  Layer,
  MutableHashMap,
  MutableHashSet,
  MutableList,
  type Path,
  Record as Rec,
  Schema,
} from "effect";
import { FetchHttpClient } from "effect/http";
import {
  ARTICLE,
  indexingPaths,
  JOB_POSTING,
  memoryFiles,
  recordLogs,
  runToEnd,
  runToFailure,
} from "@/scripts/indexing/fixture";
import { runGoogleIndexing } from "@/scripts/indexing/google/run";
import { loadSubmissionHistory } from "@/scripts/indexing/history";

// Signing uses real Web Crypto, which the test clock does not advance, so the
// token step is doubled here. auth.test.ts covers the signed assertion itself.
const authMocks = vi.hoisted(() => ({
  getGoogleAccessToken: vi.fn(),
}));
const sitemapMocks = vi.hoisted(() => ({
  getSitemapEntries: vi.fn(),
  readSitemapPageDescriptors: vi.fn(),
}));

vi.mock("@/lib/sitemap/catalog", () => ({
  readSitemapPageDescriptors: sitemapMocks.readSitemapPageDescriptors,
}));

vi.mock("@/lib/sitemap/entries", () => ({
  getSitemapEntries: sitemapMocks.getSitemapEntries,
}));

vi.mock("@/scripts/indexing/google/auth", () => ({
  getGoogleAccessToken: authMocks.getGoogleAccessToken,
}));

const ACCESS_TOKEN = "test-access-token";
const FIRST = "https://nakafa.com/id/first";
const SECOND = "https://nakafa.com/id/second";
const THIRD = "https://nakafa.com/id/third";
const EARLIER_STAMP = "2026-01-01T00:00:00.000Z";
const PublishBodySchema = Schema.fromJsonString(
  Schema.Struct({ type: Schema.String, url: Schema.String })
);
/** One fetch double for the whole file, provided to the module's own client. */
const fetcher = vi.fn<typeof fetch>();
/** The canonical URL of the sitemap page at this index. */
const pageUrl = (index: number) => `https://nakafa.com/id/page-${index}`;

beforeEach(() => {
  fetcher.mockReset();
  sitemapMocks.getSitemapEntries.mockReset();
  sitemapMocks.readSitemapPageDescriptors.mockReset();
  authMocks.getGoogleAccessToken.mockReset();
  authMocks.getGoogleAccessToken.mockReturnValue(Effect.succeed(ACCESS_TOKEN));
});

/** A sitemap page whose only JSON-LD block is `jsonLd`. */
const pageWith = (jsonLd: string) =>
  new Response(
    `<html><head><script type="application/ld+json">${jsonLd}</script></head><body></body></html>`,
    { status: 200 }
  );

/** Google accepts the URL. */
const accepted = async () => new Response("{}", { status: 200 });
/** Google refuses the URL with a server error, which does not stop the run. */
const refused = async () => new Response("", { status: 500 });
/** Google answers that it is rate limiting, which stops the run. */
const rateLimited = async () => new Response("", { status: 429 });
/** The request never reaches Google. */
const unreachable = () => Promise.reject(new TypeError("fetch failed"));

/** Lists one sitemap page that holds these canonical URLs, in order. */
function sitemapOf(urls: readonly string[]) {
  sitemapMocks.readSitemapPageDescriptors.mockReturnValue(
    Effect.succeed([{ id: "public_id_0" }])
  );
  sitemapMocks.getSitemapEntries.mockReturnValue(
    Effect.succeed(Arr.map(urls, (url) => ({ url })))
  );
}

/**
 * Answers the requests of one run. A sitemap page carries JobPosting JSON-LD
 * when its URL is in `eligible`, and an article otherwise. Each publish request
 * is logged in `events` and answered by `publish`.
 */
function answerRun(
  events: MutableList.MutableList<string>,
  eligible: readonly string[],
  publish: (url: string) => Promise<Response>
) {
  fetcher.mockImplementation((input, init) => {
    if (init?.method !== "POST") {
      return Promise.resolve(
        pageWith(Arr.contains(eligible, String(input)) ? JOB_POSTING : ARTICLE)
      );
    }
    const { url } = Schema.decodeSync(PublishBodySchema)(String(init.body));
    MutableList.append(events, `publish ${url}`);
    return publish(url);
  });
}

/** A history file that records one Google URL as submitted. */
const historyWith = (url: string) =>
  encodePrettyJsonText({
    bing: {},
    googleIndexingApi: { [url]: EARLIER_STAMP },
    indexNow: {},
  });

/** Runs the Google flow with the module's own client, this file's fetch double, and the given files. */
function runGoogle(
  files: Layer.Layer<FileSystem.FileSystem | Path.Path>,
  lines: MutableList.MutableList<string>
) {
  return runGoogleIndexing().pipe(
    Effect.provide(Layer.mergeAll(FetchClient, files, recordLogs(lines))),
    Effect.provideService(FetchHttpClient.Fetch, fetcher)
  );
}

describe("runGoogleIndexing", () => {
  it.effect(
    "submits nothing and writes nothing when no sitemap URL is eligible",
    () => {
      const events = MutableList.make<string>();
      const lines = MutableList.make<string>();
      return Effect.gen(function* () {
        const { stateFolder, submissionHistory } = yield* indexingPaths;
        const memory = memoryFiles(events, []);
        sitemapOf([FIRST, SECOND]);
        answerRun(events, [], accepted);

        yield* runToEnd(runGoogle(memory.layer, lines));

        expect(MutableList.toArray(events)).toEqual([]);
        expect(authMocks.getGoogleAccessToken).not.toHaveBeenCalled();
        expect(MutableHashSet.has(memory.directories, stateFolder)).toBe(false);
        expect(MutableHashMap.has(memory.files, submissionHistory)).toBe(false);
        expect(MutableList.toArray(lines)).toContain(
          "No Google Indexing API eligible URLs were found in current sitemap pages."
        );
      });
    }
  );

  it.effect(
    "submits nothing and writes nothing when every eligible URL is already in the history",
    () => {
      const events = MutableList.make<string>();
      const lines = MutableList.make<string>();
      return Effect.gen(function* () {
        const { submissionHistory } = yield* indexingPaths;
        const memory = memoryFiles(events, [
          [submissionHistory, historyWith(FIRST)],
        ]);
        sitemapOf([FIRST]);
        answerRun(events, [FIRST], accepted);

        yield* runToEnd(runGoogle(memory.layer, lines));

        expect(MutableList.toArray(events)).toEqual([]);
        expect(authMocks.getGoogleAccessToken).not.toHaveBeenCalled();
        expect(MutableList.toArray(lines)).toContain(
          "All Google Indexing API eligible URLs were already submitted."
        );
      });
    }
  );

  it.effect("submits two eligible URLs and saves both", () => {
    const events = MutableList.make<string>();
    const lines = MutableList.make<string>();
    return Effect.gen(function* () {
      const { submissionHistory } = yield* indexingPaths;
      const memory = memoryFiles(events, []);
      sitemapOf([FIRST, SECOND]);
      answerRun(events, [FIRST, SECOND], accepted);

      yield* runToEnd(runGoogle(memory.layer, lines));

      expect(MutableList.toArray(events)).toEqual([
        `publish ${FIRST}`,
        `publish ${SECOND}`,
        `write ${submissionHistory}`,
      ]);
      const history = yield* loadSubmissionHistory().pipe(
        Effect.provide(memory.layer)
      );
      expect(Rec.keys(history.googleIndexingApi)).toEqual([FIRST, SECOND]);
    });
  });

  it.effect(
    "submits only the URLs whose live JSON-LD allows the Indexing API",
    () => {
      const events = MutableList.make<string>();
      const lines = MutableList.make<string>();
      return Effect.gen(function* () {
        const { submissionHistory } = yield* indexingPaths;
        const memory = memoryFiles(events, []);
        sitemapOf([FIRST, SECOND, THIRD]);
        answerRun(events, [FIRST, THIRD], accepted);

        yield* runToEnd(runGoogle(memory.layer, lines));

        expect(MutableList.toArray(events)).toEqual([
          `publish ${FIRST}`,
          `publish ${THIRD}`,
          `write ${submissionHistory}`,
        ]);
        expect(MutableList.toArray(lines)).toContain(
          "Canonical URLs in sitemap batch 1: 3"
        );
        expect(MutableList.toArray(lines)).toContain(
          "Google Indexing API eligible URLs in batch 1: 2"
        );
      });
    }
  );

  it.effect(
    "counts the accepted and the refused URLs and logs the success rate",
    () => {
      const events = MutableList.make<string>();
      const lines = MutableList.make<string>();
      return Effect.gen(function* () {
        const { submissionHistory } = yield* indexingPaths;
        const memory = memoryFiles(events, []);
        sitemapOf([FIRST, SECOND, THIRD]);
        answerRun(events, [FIRST, SECOND, THIRD], (url) =>
          url === SECOND ? refused() : accepted()
        );

        yield* runToEnd(runGoogle(memory.layer, lines));

        const logged = MutableList.toArray(lines);
        expect(logged).toContain("Total eligible URLs queued: 3");
        expect(logged).toContain("Successfully submitted: 2");
        expect(logged).toContain("Rejected or skipped: 1");
        expect(logged).toContain("Success rate: 67%");
        expect(logged).toContain("Google sitemap batches processed: 1");
        expect(logged).toContain("Google canonical URLs inspected: 3");
        expect(logged).not.toContain(
          "Low success rate indicates Google API rate limiting or errors."
        );
        const history = yield* loadSubmissionHistory().pipe(
          Effect.provide(memory.layer)
        );
        expect(Rec.keys(history.googleIndexingApi)).toEqual([FIRST, THIRD]);
        expect(MutableList.toArray(events)).toEqual([
          `publish ${FIRST}`,
          `publish ${SECOND}`,
          `publish ${THIRD}`,
          `write ${submissionHistory}`,
        ]);
      });
    }
  );

  it.effect(
    "keeps the first URL when the second request fails, then a second run submits only the URL left",
    () => {
      const events = MutableList.make<string>();
      const lines = MutableList.make<string>();
      return Effect.gen(function* () {
        const { submissionHistory } = yield* indexingPaths;
        const memory = memoryFiles(events, []);
        sitemapOf([FIRST, SECOND]);
        answerRun(events, [FIRST, SECOND], (url) =>
          url === SECOND ? unreachable() : accepted()
        );

        const failure = yield* runToFailure(runGoogle(memory.layer, lines));
        // The failure reaches the caller only after the history write.
        MutableList.append(events, "raised");

        expect(failure).toMatchObject({
          _tag: "GoogleIndexSubmitError",
          message: `Network error submitting ${SECOND}.`,
        });
        answerRun(events, [FIRST, SECOND], accepted);
        yield* runToEnd(runGoogle(memory.layer, lines));

        expect(MutableList.toArray(events)).toEqual([
          `publish ${FIRST}`,
          `publish ${SECOND}`,
          `write ${submissionHistory}`,
          "raised",
          `publish ${SECOND}`,
          `write ${submissionHistory}`,
        ]);
        const history = yield* loadSubmissionHistory().pipe(
          Effect.provide(memory.layer)
        );
        expect(Rec.keys(history.googleIndexingApi)).toEqual([FIRST, SECOND]);
      });
    }
  );

  it.effect("fails when Google accepts no URL, and writes nothing", () => {
    const events = MutableList.make<string>();
    const lines = MutableList.make<string>();
    return Effect.gen(function* () {
      const { submissionHistory } = yield* indexingPaths;
      const memory = memoryFiles(events, []);
      sitemapOf([FIRST, SECOND]);
      answerRun(events, [FIRST, SECOND], refused);

      const failure = yield* runToFailure(runGoogle(memory.layer, lines));

      expect(failure).toMatchObject({
        _tag: "GoogleIndexSubmitError",
        message: "Google Indexing API submission submitted zero queued URLs.",
      });
      expect(MutableList.toArray(events)).toEqual([
        `publish ${FIRST}`,
        `publish ${SECOND}`,
      ]);
      expect(MutableHashMap.has(memory.files, submissionHistory)).toBe(false);
      const logged = MutableList.toArray(lines);
      expect(logged).toContain(
        "Low success rate indicates Google API rate limiting or errors."
      );
      expect(logged).toContain("Success rate: 0%");
    });
  });

  it.effect(
    "stops the whole run at a 429, saves the accepted URLs of that batch, and sends nothing from the next sitemap batch",
    () => {
      const events = MutableList.make<string>();
      const lines = MutableList.make<string>();
      const urls = Arr.makeBy(501, pageUrl);
      return Effect.gen(function* () {
        const { submissionHistory } = yield* indexingPaths;
        const memory = memoryFiles(events, []);
        sitemapOf(urls);
        answerRun(events, [pageUrl(0), pageUrl(1), pageUrl(500)], (url) =>
          url === pageUrl(1) ? rateLimited() : accepted()
        );

        yield* runToEnd(runGoogle(memory.layer, lines));

        expect(MutableList.toArray(events)).toEqual([
          `publish ${pageUrl(0)}`,
          `publish ${pageUrl(1)}`,
          `write ${submissionHistory}`,
        ]);
        expect(
          Arr.some(
            fetcher.mock.calls,
            ([input]) => String(input) === pageUrl(500)
          )
        ).toBe(false);
        const logged = MutableList.toArray(lines);
        expect(logged).toContain("Google sitemap batches processed: 1");
        expect(logged).toContain("Google canonical URLs inspected: 500");
        expect(logged).toContain("Total eligible URLs queued: 2");
        expect(logged).toContain("Successfully submitted: 1");
        expect(logged).toContain("Rejected or skipped: 1");
        const history = yield* loadSubmissionHistory().pipe(
          Effect.provide(memory.layer)
        );
        expect(Rec.keys(history.googleIndexingApi)).toEqual([pageUrl(0)]);
      });
    }
  );

  it.effect("keeps one history across sitemap batches of 500 URLs", () => {
    const events = MutableList.make<string>();
    const lines = MutableList.make<string>();
    const urls = Arr.makeBy(
      501,
      (index) => `https://nakafa.com/id/page-${index}`
    );
    const firstBatchUrl = urls[0] ?? "";
    const secondBatchUrl = urls[500] ?? "";
    return Effect.gen(function* () {
      const { submissionHistory } = yield* indexingPaths;
      const memory = memoryFiles(events, []);
      sitemapOf(urls);
      answerRun(events, [firstBatchUrl, secondBatchUrl], accepted);

      yield* runToEnd(runGoogle(memory.layer, lines));

      expect(MutableList.toArray(events)).toEqual([
        `publish ${firstBatchUrl}`,
        `write ${submissionHistory}`,
        `publish ${secondBatchUrl}`,
        `write ${submissionHistory}`,
      ]);
      expect(MutableList.toArray(lines)).toContain(
        "Google sitemap batches processed: 2"
      );
      expect(MutableList.toArray(lines)).toContain(
        "Google canonical URLs inspected: 501"
      );
      const history = yield* loadSubmissionHistory().pipe(
        Effect.provide(memory.layer)
      );
      expect(Rec.keys(history.googleIndexingApi)).toEqual([
        firstBatchUrl,
        secondBatchUrl,
      ]);
    });
  });

  it.effect(
    "reads the second sitemap batch after a first batch with no eligible URL, and publishes its URL",
    () => {
      const events = MutableList.make<string>();
      const lines = MutableList.make<string>();
      const urls = Arr.makeBy(501, pageUrl);
      return Effect.gen(function* () {
        const { submissionHistory } = yield* indexingPaths;
        const memory = memoryFiles(events, []);
        sitemapOf(urls);
        answerRun(events, [pageUrl(500)], accepted);

        yield* runToEnd(runGoogle(memory.layer, lines));

        expect(MutableList.toArray(events)).toEqual([
          `publish ${pageUrl(500)}`,
          `write ${submissionHistory}`,
        ]);
        expect(MutableList.toArray(lines)).toContain(
          "Google sitemap batches processed: 2"
        );
        const history = yield* loadSubmissionHistory().pipe(
          Effect.provide(memory.layer)
        );
        expect(Rec.keys(history.googleIndexingApi)).toEqual([pageUrl(500)]);
      });
    }
  );

  it.effect(
    "reads the second sitemap batch after a first batch whose eligible URLs are all submitted, and keeps the old stamp",
    () => {
      const events = MutableList.make<string>();
      const lines = MutableList.make<string>();
      const urls = Arr.makeBy(501, pageUrl);
      return Effect.gen(function* () {
        const { submissionHistory } = yield* indexingPaths;
        const memory = memoryFiles(events, [
          [submissionHistory, historyWith(pageUrl(0))],
        ]);
        sitemapOf(urls);
        answerRun(events, [pageUrl(0), pageUrl(500)], accepted);

        yield* runToEnd(runGoogle(memory.layer, lines));

        expect(MutableList.toArray(events)).toEqual([
          `publish ${pageUrl(500)}`,
          `write ${submissionHistory}`,
        ]);
        const history = yield* loadSubmissionHistory().pipe(
          Effect.provide(memory.layer)
        );
        expect(Rec.keys(history.googleIndexingApi)).toEqual([
          pageUrl(0),
          pageUrl(500),
        ]);
        expect(history.googleIndexingApi[pageUrl(0)]).toBe(EARLIER_STAMP);
      });
    }
  );
});
