// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { FetchClient } from "@repo/utilities/http/client";
import { encodePrettyJsonText } from "@repo/utilities/json";
import {
  Array as Arr,
  ConfigProvider,
  Effect,
  Fiber,
  FileSystem,
  Layer,
  Logger,
  MutableHashMap,
  MutableHashSet,
  MutableList,
  Path,
  PlatformError,
  Record as Rec,
  Schema,
} from "effect";
import { FetchHttpClient } from "effect/http";
import { TestClock } from "effect/testing";
import { loadSubmissionHistory } from "@/scripts/indexing/history";
import { runIndexNow } from "@/scripts/indexing/indexnow/run";
import {
  INDEXNOW_KEY,
  INDEXNOW_KEY_LOCATION,
  indexingFiles,
} from "@/scripts/indexing/paths";

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

const BING_KEY = "test-bing-key";
const FIRST = "https://nakafa.com/id/first";
const SECOND = "https://nakafa.com/id/second";
const INDEXNOW_HOSTNAME = "api.indexnow.org";
const BING_HOSTNAME = "ssl.bing.com";
const RequestBodySchema = Schema.fromJsonString(
  Schema.Struct({
    host: Schema.String,
    key: Schema.String,
    keyLocation: Schema.String,
    urlList: Schema.Array(Schema.String),
  })
);
/** Both services name their URLs in `urlList`, though their other fields differ. */
const UrlListBodySchema = Schema.fromJsonString(
  Schema.Struct({ urlList: Schema.Array(Schema.String) })
);
/** One fetch double for the whole file, provided to the module's own client. */
const fetcher = vi.fn<typeof fetch>();
/** The state paths of the real checkout, read through the real path service. */
const indexingPaths = indexingFiles.pipe(Effect.provide(Path.layer));

beforeEach(() => {
  fetcher.mockReset();
  sitemapMocks.getSitemapEntries.mockReset();
  sitemapMocks.readSitemapPageDescriptors.mockReset();
});

/** Lists one sitemap page that holds these canonical URLs, in order. */
function sitemapOf(urls: readonly string[]) {
  sitemapMocks.readSitemapPageDescriptors.mockReturnValue(
    Effect.succeed([{ id: "public_id_0" }])
  );
  sitemapMocks.getSitemapEntries.mockReturnValue(
    Effect.succeed(Arr.map(urls, (url) => ({ url })))
  );
}

/** Builds n distinct canonical URLs for one sitemap page. */
function urlsOf(count: number) {
  return Arr.makeBy(count, (index) => `https://nakafa.com/id/page-${index}`);
}

/** An answer with the given status and body text. */
const answer = (status: number, body = "") => new Response(body, { status });

/** The host of a request that the flow sent. */
const hostnameOf = (input: unknown) => new URL(String(input)).hostname;

/** The requests that the flow sent to one host, in order. */
const requestsTo = (hostname: string) =>
  Arr.filter(fetcher.mock.calls, ([input]) => hostnameOf(input) === hostname);

/**
 * A file system held in memory for one test, seeded with `seeded` entries and
 * merged with the real path service. Each write is logged in `events`, in the
 * order the module makes it.
 */
function memoryFiles(
  events: MutableList.MutableList<string>,
  seeded: readonly (readonly [string, string])[]
) {
  const files = MutableHashMap.fromIterable(seeded);
  const directories = MutableHashSet.empty<string>();
  const layer = FileSystem.layerNoop({
    exists: (path) =>
      Effect.sync(
        () =>
          MutableHashMap.has(files, path) ||
          MutableHashSet.has(directories, path)
      ),
    makeDirectory: (path) =>
      Effect.sync(() => {
        MutableHashSet.add(directories, path);
      }),
    readFileString: (path) =>
      Effect.fromOption(MutableHashMap.get(files, path)).pipe(
        Effect.mapError(() =>
          PlatformError.systemError({
            _tag: "NotFound",
            method: "readFileString",
            module: "FileSystem",
            pathOrDescriptor: path,
          })
        )
      ),
    writeFileString: (path, text) =>
      Effect.sync(() => {
        MutableHashMap.set(files, path, text);
        MutableList.append(events, `write ${path}`);
      }),
  });
  return {
    directories,
    files,
    layer: Layer.merge(Path.layer, layer),
  };
}

/** Routes every log line of an effect into `lines`, instead of the console. */
const recordLogs = (lines: MutableList.MutableList<string>) =>
  Logger.layer([
    Logger.make<unknown, void>(({ message }) => {
      MutableList.append(lines, String(message));
    }),
  ]);

/**
 * Runs the IndexNow and Bing flow with the module's own client, this file's
 * fetch double, the given files, and a fake environment that holds the Bing key
 * only when a test sets one.
 */
function runIndexNowWith(
  files: Layer.Layer<FileSystem.FileSystem | Path.Path>,
  lines: MutableList.MutableList<string>,
  env: Readonly<Record<string, string>>
) {
  return runIndexNow().pipe(
    Effect.provide(Layer.mergeAll(FetchClient, files, recordLogs(lines))),
    Effect.provideService(FetchHttpClient.Fetch, fetcher),
    Effect.provideService(
      ConfigProvider.ConfigProvider,
      ConfigProvider.fromEnvRecord(env)
    )
  );
}

/** Runs an effect to its end while the test clock passes every wait between its requests. */
function runToEnd<A, E>(effect: Effect.Effect<A, E>) {
  return Effect.gen(function* () {
    const fiber = yield* Effect.forkChild(effect);
    yield* TestClock.adjust("1 minute");
    return yield* Fiber.join(fiber);
  });
}

/** Runs an effect that must fail, and returns its typed failure. */
function runToFailure<A, E>(effect: Effect.Effect<A, E>) {
  return runToEnd(Effect.flip(effect));
}

/** The URL list of each request that the flow sent, in order. */
function sentUrlLists() {
  return Arr.map(
    fetcher.mock.calls,
    ([, init]) =>
      Schema.decodeSync(UrlListBodySchema)(String(init?.body)).urlList
  );
}

describe("runIndexNow", () => {
  it.effect(
    "sends every canonical URL to IndexNow in one request, and skips Bing without a key",
    () => {
      const events = MutableList.make<string>();
      const lines = MutableList.make<string>();
      return Effect.gen(function* () {
        const { submissionHistory } = yield* indexingPaths;
        const memory = memoryFiles(events, []);
        sitemapOf([FIRST, SECOND]);
        fetcher.mockResolvedValueOnce(answer(200));

        yield* runToEnd(runIndexNowWith(memory.layer, lines, {}));

        expect(fetcher).toHaveBeenCalledOnce();
        const [input, init] = fetcher.mock.calls[0] ?? [];
        expect(new URL(String(input)).hostname).toBe(INDEXNOW_HOSTNAME);
        expect(
          yield* Schema.decodeEffect(RequestBodySchema)(String(init?.body))
        ).toEqual({
          host: "nakafa.com",
          key: INDEXNOW_KEY,
          keyLocation: INDEXNOW_KEY_LOCATION,
          urlList: [FIRST, SECOND],
        });
        expect(MutableList.toArray(lines)).toContain(
          "Bing Webmaster API key not configured. Skipping Bing URL Submission."
        );
        expect(MutableList.toArray(events)).toEqual([
          `write ${submissionHistory}`,
        ]);
        const history = yield* loadSubmissionHistory().pipe(
          Effect.provide(memory.layer)
        );
        expect(Rec.keys(history.indexNow)).toEqual([FIRST, SECOND]);
        expect(history.bing).toEqual({});
      });
    }
  );

  it.effect(
    "sends nothing and writes nothing when IndexNow already has every URL",
    () => {
      const events = MutableList.make<string>();
      const lines = MutableList.make<string>();
      return Effect.gen(function* () {
        const { submissionHistory } = yield* indexingPaths;
        const memory = memoryFiles(events, [
          [
            submissionHistory,
            encodePrettyJsonText({
              bing: {},
              googleIndexingApi: {},
              indexNow: { [FIRST]: "2026-01-01T00:00:00.000Z" },
            }),
          ],
        ]);
        sitemapOf([FIRST]);

        yield* runToEnd(runIndexNowWith(memory.layer, lines, {}));

        expect(fetcher).not.toHaveBeenCalled();
        expect(MutableList.toArray(events)).toEqual([]);
        expect(MutableList.toArray(lines)).toContain(
          "No new URLs to submit to IndexNow. All canonical URLs have been previously submitted."
        );
      });
    }
  );

  it.effect(
    "keeps the first IndexNow batch when a later batch is rejected, and the next run sends only the rest",
    () => {
      const events = MutableList.make<string>();
      const lines = MutableList.make<string>();
      const urls = urlsOf(150);
      return Effect.gen(function* () {
        const { submissionHistory } = yield* indexingPaths;
        const memory = memoryFiles(events, []);
        sitemapOf(urls);
        fetcher
          .mockResolvedValueOnce(answer(200))
          .mockResolvedValueOnce(answer(500));

        const failure = yield* runToFailure(
          runIndexNowWith(memory.layer, lines, {})
        );
        // The failure reaches the caller only after the history write.
        MutableList.append(events, "raised");

        expect(failure).toMatchObject({
          _tag: "IndexNowSubmitError",
          message: "IndexNow batch 2 failed with HTTP 500.",
        });
        const afterFailure = yield* loadSubmissionHistory().pipe(
          Effect.provide(memory.layer)
        );
        expect(Rec.keys(afterFailure.indexNow)).toEqual(Arr.take(urls, 100));

        fetcher.mockResolvedValueOnce(answer(200));
        yield* runToEnd(runIndexNowWith(memory.layer, lines, {}));

        expect(sentUrlLists()[2]).toEqual(Arr.drop(urls, 100));
        expect(MutableList.toArray(events)).toEqual([
          `write ${submissionHistory}`,
          "raised",
          `write ${submissionHistory}`,
        ]);
        const history = yield* loadSubmissionHistory().pipe(
          Effect.provide(memory.layer)
        );
        expect(Rec.keys(history.indexNow)).toEqual(urls);
      });
    }
  );

  it.effect(
    "sends the URLs that IndexNow has to Bing, and keeps each service's record apart",
    () => {
      const events = MutableList.make<string>();
      const lines = MutableList.make<string>();
      return Effect.gen(function* () {
        const memory = memoryFiles(events, []);
        sitemapOf([FIRST, SECOND]);
        fetcher.mockResolvedValueOnce(answer(200));
        yield* runToEnd(runIndexNowWith(memory.layer, lines, {}));
        const before = yield* loadSubmissionHistory().pipe(
          Effect.provide(memory.layer)
        );

        fetcher.mockResolvedValueOnce(answer(200));
        yield* runToEnd(
          runIndexNowWith(memory.layer, lines, {
            BING_WEBMASTER_API_KEY: BING_KEY,
          })
        );

        const bingRequest = new URL(String(fetcher.mock.calls[1]?.[0]));
        expect(bingRequest.hostname).toBe(BING_HOSTNAME);
        expect(sentUrlLists()[1]).toEqual([FIRST, SECOND]);
        const history = yield* loadSubmissionHistory().pipe(
          Effect.provide(memory.layer)
        );
        expect(Rec.keys(history.bing)).toEqual([FIRST, SECOND]);
        expect(history.indexNow).toEqual(before.indexNow);
      });
    }
  );

  it.effect("sends nothing to Bing when Bing already has every URL", () => {
    const events = MutableList.make<string>();
    const lines = MutableList.make<string>();
    return Effect.gen(function* () {
      const { submissionHistory } = yield* indexingPaths;
      const recorded = "2026-01-01T00:00:00.000Z";
      const memory = memoryFiles(events, [
        [
          submissionHistory,
          encodePrettyJsonText({
            bing: { [FIRST]: recorded, [SECOND]: recorded },
            googleIndexingApi: {},
            indexNow: { [FIRST]: recorded, [SECOND]: recorded },
          }),
        ],
      ]);
      sitemapOf([FIRST, SECOND]);

      yield* runToEnd(
        runIndexNowWith(memory.layer, lines, {
          BING_WEBMASTER_API_KEY: BING_KEY,
        })
      );

      expect(fetcher).not.toHaveBeenCalled();
      expect(MutableList.toArray(events)).toEqual([]);
      expect(MutableList.toArray(lines)).toContain(
        "No new URLs to submit to Bing. All canonical URLs have been previously submitted."
      );
    });
  });

  it.effect(
    "keeps the URLs Bing accepted when a later Bing batch fails, and leaves the IndexNow record as it was",
    () => {
      const events = MutableList.make<string>();
      const lines = MutableList.make<string>();
      const urls = urlsOf(150);
      return Effect.gen(function* () {
        const { submissionHistory } = yield* indexingPaths;
        const memory = memoryFiles(events, []);
        sitemapOf(urls);
        fetcher
          .mockResolvedValueOnce(answer(200))
          .mockResolvedValueOnce(answer(200))
          .mockResolvedValueOnce(answer(200))
          .mockResolvedValueOnce(answer(500, "Internal error"));

        const failure = yield* runToFailure(
          runIndexNowWith(memory.layer, lines, {
            BING_WEBMASTER_API_KEY: BING_KEY,
          })
        );

        expect(failure).toMatchObject({
          _tag: "BingSubmitError",
          message: "Bing failed with HTTP 500.",
        });
        // IndexNow's 150 URLs are saved, then Bing's first 100 are saved.
        expect(MutableList.toArray(events)).toEqual([
          `write ${submissionHistory}`,
          `write ${submissionHistory}`,
        ]);
        const history = yield* loadSubmissionHistory().pipe(
          Effect.provide(memory.layer)
        );
        expect(Rec.keys(history.indexNow)).toEqual(urls);
        expect(Rec.keys(history.bing)).toEqual(Arr.take(urls, 100));
      });
    }
  );

  it.effect(
    "stops Bing at the daily quota text, saves the accepted Bing URLs, and sends nothing from the next sitemap batch",
    () => {
      const events = MutableList.make<string>();
      const lines = MutableList.make<string>();
      const bingRequests = MutableList.make<string>();
      const urls = urlsOf(501);
      return Effect.gen(function* () {
        const memory = memoryFiles(events, []);
        sitemapOf(urls);
        fetcher.mockImplementation((input) => {
          if (hostnameOf(input) === INDEXNOW_HOSTNAME) {
            return Promise.resolve(answer(200));
          }
          MutableList.append(bingRequests, String(input));
          return Promise.resolve(
            bingRequests.length === 1
              ? answer(200)
              : answer(
                  403,
                  "You have exceeded your daily URL submission quota."
                )
          );
        });

        yield* runToEnd(
          runIndexNowWith(memory.layer, lines, {
            BING_WEBMASTER_API_KEY: BING_KEY,
          })
        );

        // IndexNow reads both sitemap batches: five requests for 500 URLs, one for the last URL.
        expect(requestsTo(INDEXNOW_HOSTNAME)).toHaveLength(6);
        expect(bingRequests.length).toBe(2);
        const logged = MutableList.toArray(lines);
        expect(logged).toContain("Bing sitemap batches processed: 1");
        expect(logged).toContain("Bing canonical URLs inspected: 500");
        const history = yield* loadSubmissionHistory().pipe(
          Effect.provide(memory.layer)
        );
        expect(Rec.keys(history.bing)).toEqual(Arr.take(urls, 100));
        expect(Rec.keys(history.indexNow)).toEqual(urls);
      });
    }
  );
});
