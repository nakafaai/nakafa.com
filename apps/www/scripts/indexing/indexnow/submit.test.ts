// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { FetchClient } from "@repo/utilities/http/client";
import {
  Array as Arr,
  Effect,
  Fiber,
  Logger,
  MutableList,
  Schema,
} from "effect";
import { FetchHttpClient } from "effect/http";
import { TestClock } from "effect/testing";
import { submitUrlsToIndexNow } from "@/scripts/indexing/indexnow/submit";

const INDEXNOW_ENDPOINT = "https://api.indexnow.org/";
const KEY = "test-indexnow-key";
const RequestBodySchema = Schema.fromJsonString(
  Schema.Struct({
    host: Schema.String,
    key: Schema.String,
    keyLocation: Schema.String,
    urlList: Schema.Array(Schema.String),
  })
);
/** One fetch double for the whole file, provided to the module's own client. */
const fetcher = vi.fn<typeof fetch>();

beforeEach(() => {
  fetcher.mockReset();
});

/** Submits URLs through the module's own client and this file's fetch double. */
function submitUrls(urls: string[]) {
  return submitUrlsToIndexNow(urls, KEY).pipe(
    Effect.provide(FetchClient),
    Effect.provideService(FetchHttpClient.Fetch, fetcher)
  );
}

/** Builds n distinct canonical URLs for one submission. */
function urlsOf(count: number) {
  return Arr.makeBy(count, (index) => `https://nakafa.com/id/page-${index}`);
}

/** An answer that carries only a status. */
const answer = (status: number) => new Response(null, { status });

/** The URL count of each batch that the adapter sent, in order. */
function sentBatchSizes() {
  return Arr.map(
    fetcher.mock.calls,
    ([, init]) =>
      Schema.decodeSync(RequestBodySchema)(String(init?.body)).urlList.length
  );
}

/** Routes every log line of an effect into `lines`, instead of the console. */
const recordLogs = (lines: MutableList.MutableList<string>) =>
  Logger.layer([
    Logger.make<unknown, void>(({ message }) => {
      MutableList.append(lines, String(message));
    }),
  ]);

describe("submitUrlsToIndexNow", () => {
  it.effect("sends nothing for an empty URL list", () =>
    Effect.gen(function* () {
      expect(yield* submitUrls([])).toEqual([]);
      expect(fetcher).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "counts the URLs of a batch that the endpoint answers with 200",
    () =>
      Effect.gen(function* () {
        const urls = urlsOf(2);
        fetcher.mockResolvedValueOnce(answer(200));

        expect(yield* submitUrls(urls)).toEqual(urls);
        expect(fetcher).toHaveBeenCalledOnce();
        const [input, init] = fetcher.mock.calls[0] ?? [];
        expect(String(input)).toBe(INDEXNOW_ENDPOINT);
        expect(init?.method).toBe("POST");
        expect(
          Schema.decodeSync(RequestBodySchema)(String(init?.body))
        ).toMatchObject({ host: "nakafa.com", key: KEY, urlList: urls });
      })
  );

  it.effect(
    "counts the URLs of a batch that the endpoint receives with 202, and logs that key validation is pending",
    () =>
      Effect.gen(function* () {
        const urls = urlsOf(2);
        const lines = MutableList.make<string>();
        fetcher.mockResolvedValueOnce(answer(202));

        expect(
          yield* submitUrls(urls).pipe(Effect.provide(recordLogs(lines)))
        ).toEqual(urls);
        expect(
          Arr.filter(MutableList.toArray(lines), (line) =>
            line.includes("key validation is pending")
          )
        ).toHaveLength(1);
      })
  );

  it.effect.each([400, 403, 422, 429, 500])(
    "fails the batch with the status when the endpoint answers %i",
    (status) =>
      Effect.gen(function* () {
        fetcher.mockResolvedValueOnce(answer(status));

        expect(yield* submitUrls(urlsOf(2)).pipe(Effect.flip)).toMatchObject({
          _tag: "IndexNowSubmitError",
          cause: status,
          message: `IndexNow batch 1 failed with HTTP ${status}.`,
        });
      })
  );

  it.effect(
    "fails with a deadline when the endpoint never answers, at 10 s",
    () =>
      Effect.gen(function* () {
        fetcher.mockImplementation(
          () => new Promise<Response>(() => undefined)
        );
        const fiber = yield* Effect.forkChild(
          submitUrls(urlsOf(2)).pipe(Effect.flip)
        );

        yield* TestClock.adjust("10 seconds");

        expect(yield* Fiber.join(fiber)).toMatchObject({
          _tag: "IndexNowSubmitError",
          cause: "deadline",
          message: "IndexNow batch 1 did not answer within 10 seconds.",
        });
      })
  );

  it.effect("fails with the typed error when the request is rejected", () =>
    Effect.gen(function* () {
      fetcher.mockRejectedValueOnce(new TypeError("fetch failed"));

      expect(yield* submitUrls(urlsOf(2)).pipe(Effect.flip)).toMatchObject({
        _tag: "IndexNowSubmitError",
        message: "Error submitting IndexNow batch 1.",
      });
    })
  );

  it.effect("sends batches of 100 URLs, one second apart", () =>
    Effect.gen(function* () {
      fetcher.mockImplementation(async () => answer(200));
      const urls = urlsOf(250);
      const fiber = yield* Effect.forkChild(submitUrls(urls));

      yield* TestClock.adjust("999 millis");
      expect(fetcher).toHaveBeenCalledTimes(1);
      yield* TestClock.adjust("1 millis");
      expect(fetcher).toHaveBeenCalledTimes(2);
      yield* TestClock.adjust("1 second");
      expect(fetcher).toHaveBeenCalledTimes(3);

      expect(yield* Fiber.join(fiber)).toEqual(urls);
      expect(sentBatchSizes()).toEqual([100, 100, 50]);
    })
  );

  it.effect(
    "pins today's result: a rejected second batch fails the call, so the first batch is not returned",
    () =>
      Effect.gen(function* () {
        fetcher
          .mockResolvedValueOnce(answer(200))
          .mockResolvedValueOnce(answer(500));
        const fiber = yield* Effect.forkChild(
          submitUrls(urlsOf(150)).pipe(Effect.flip)
        );

        yield* TestClock.adjust("1 second");

        expect(yield* Fiber.join(fiber)).toMatchObject({
          _tag: "IndexNowSubmitError",
          cause: 500,
        });
        expect(fetcher).toHaveBeenCalledTimes(2);
      })
  );
});
