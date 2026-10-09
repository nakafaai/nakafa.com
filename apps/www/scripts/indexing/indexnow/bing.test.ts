// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { FetchClient } from "@repo/utilities/http/client";
import {
  Array as Arr,
  ConfigProvider,
  Effect,
  Fiber,
  Option,
  Schema,
} from "effect";
import { FetchHttpClient } from "effect/http";
import { TestClock } from "effect/testing";
import { answer, quotaAnswer, urlsOf } from "@/scripts/indexing/fixture";
import {
  readBingWebmasterApiKey,
  submitUrlsToBing,
} from "@/scripts/indexing/indexnow/bing";

const BING_SUBMIT_ENDPOINT =
  "https://ssl.bing.com/webmaster/api.svc/json/SubmitUrlbatch";
const API_KEY = "test-bing-key";
const PLACEHOLDER_KEY = "YOUR_BING_WEBMASTER_API_KEY";
const RequestBodySchema = Schema.fromJsonString(
  Schema.Struct({
    siteUrl: Schema.String,
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
  return submitUrlsToBing(urls, API_KEY).pipe(
    Effect.provide(FetchClient),
    Effect.provideService(FetchHttpClient.Fetch, fetcher)
  );
}

/** Reads the optional key from a fake environment, with no other configuration. */
function readKeyFrom(env: Readonly<Record<string, string>>) {
  return readBingWebmasterApiKey().pipe(
    Effect.provideService(
      ConfigProvider.ConfigProvider,
      ConfigProvider.fromEnvRecord(env)
    )
  );
}

/** A 200 answer whose body starts and never ends, so the read waits for its deadline. */
const neverEndingBody = () =>
  new Response(new ReadableStream({ start: () => undefined }), { status: 200 });

/** A 200 answer whose body fails while it is read. */
const brokenBody = () =>
  new Response(
    new ReadableStream({
      pull(controller) {
        controller.error(new Error("body interrupted"));
      },
    }),
    { status: 200 }
  );

/** The URL count of each batch that the adapter sent, in order. */
function sentBatchSizes() {
  return Arr.map(
    fetcher.mock.calls,
    ([, init]) =>
      Schema.decodeSync(RequestBodySchema)(String(init?.body)).urlList.length
  );
}

describe("readBingWebmasterApiKey", () => {
  it.effect.each([
    {
      env: {},
      expected: undefined,
      label: "returns no key when none is configured",
    },
    {
      env: { BING_WEBMASTER_API_KEY: PLACEHOLDER_KEY },
      expected: undefined,
      label: "returns no key for the placeholder, so the run sends nothing",
    },
    {
      env: { BING_WEBMASTER_API_KEY: API_KEY },
      expected: API_KEY,
      label: "returns a configured key",
    },
  ])("$label", ({ env, expected }) =>
    Effect.gen(function* () {
      expect(yield* readKeyFrom(env)).toBe(expected);
      expect(fetcher).not.toHaveBeenCalled();
    })
  );
});

describe("submitUrlsToBing", () => {
  it.effect("sends nothing for an empty URL list", () =>
    Effect.gen(function* () {
      expect(yield* submitUrls([])).toEqual({
        failure: Option.none(),
        stopped: false,
        submittedUrls: [],
      });
      expect(fetcher).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "sends batches of 100 URLs one second apart and returns every accepted URL",
    () =>
      Effect.gen(function* () {
        fetcher.mockImplementation(async () => answer(200));
        const urls = urlsOf(150);
        const fiber = yield* Effect.forkChild(submitUrls(urls));

        yield* TestClock.adjust("999 millis");
        expect(fetcher).toHaveBeenCalledTimes(1);
        yield* TestClock.adjust("1 millis");
        expect(fetcher).toHaveBeenCalledTimes(2);

        expect(yield* Fiber.join(fiber)).toEqual({
          failure: Option.none(),
          stopped: false,
          submittedUrls: urls,
        });
        expect(sentBatchSizes()).toEqual([100, 50]);
        // Bing takes the key in the query, so the request URL carries it.
        const sent = new URL(String(fetcher.mock.calls[0]?.[0]));
        expect(sent.origin + sent.pathname).toBe(BING_SUBMIT_ENDPOINT);
        expect(sent.searchParams.get("apikey")).toBe(API_KEY);
      })
  );

  it.effect(
    "stops quietly at the daily quota text, after the batches accepted before it",
    () =>
      Effect.gen(function* () {
        const urls = urlsOf(150);
        fetcher
          .mockResolvedValueOnce(answer(200))
          .mockResolvedValueOnce(
            answer(403, "You have exceeded your daily URL submission quota.")
          );
        const fiber = yield* Effect.forkChild(submitUrls(urls));

        yield* TestClock.adjust("1 second");

        expect(yield* Fiber.join(fiber)).toEqual({
          failure: Option.none(),
          stopped: true,
          submittedUrls: Arr.take(urls, 100),
        });
        expect(fetcher).toHaveBeenCalledTimes(2);
      })
  );

  it.effect(
    "shrinks the next batch to the remaining quota, then sends the rest in batches of that size",
    () =>
      Effect.gen(function* () {
        const urls = urlsOf(100);
        fetcher
          .mockResolvedValueOnce(quotaAnswer("Quota remaining for today: 30"))
          .mockImplementation(async () => answer(200));
        const fiber = yield* Effect.forkChild(submitUrls(urls));

        yield* TestClock.adjust("1 minute");

        expect(yield* Fiber.join(fiber)).toEqual({
          failure: Option.none(),
          stopped: false,
          submittedUrls: urls,
        });
        expect(sentBatchSizes()).toEqual([100, 30, 30, 30, 10]);
      })
  );

  it.effect(
    "fails with a typed failure when a quota message allows the batch it refused, so no smaller batch is sent",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValueOnce(
          quotaAnswer("Quota remaining for today: 5")
        );

        const outcome = yield* submitUrls(urlsOf(2));

        expect(outcome.stopped).toBe(false);
        expect(outcome.submittedUrls).toEqual([]);
        expect(Option.getOrUndefined(outcome.failure)).toMatchObject({
          _tag: "BingSubmitError",
          message:
            "Bing refused 2 URLs with HTTP 400 although its quota allows 5.",
        });
        expect(sentBatchSizes()).toEqual([2]);
      })
  );

  it.effect(
    "keeps the URLs accepted before a batch that the quota allows, then reports the refusal",
    () =>
      Effect.gen(function* () {
        const urls = urlsOf(150);
        fetcher
          .mockResolvedValueOnce(answer(200))
          .mockResolvedValueOnce(quotaAnswer("Quota remaining for today: 50"));
        const fiber = yield* Effect.forkChild(submitUrls(urls));

        yield* TestClock.adjust("1 second");

        const outcome = yield* Fiber.join(fiber);
        expect(outcome.stopped).toBe(false);
        expect(outcome.submittedUrls).toEqual(Arr.take(urls, 100));
        expect(Option.getOrUndefined(outcome.failure)).toMatchObject({
          _tag: "BingSubmitError",
          message:
            "Bing refused 50 URLs with HTTP 400 although its quota allows 50.",
        });
        expect(fetcher).toHaveBeenCalledTimes(2);
      })
  );

  it.effect.each([
    {
      label: "no quota is left",
      message: "Quota remaining for today: 0",
    },
    {
      label: "the quota number is missing",
      message: "Quota remaining is unknown.",
    },
  ])("stops quietly when $label", ({ message }) =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(quotaAnswer(message));

      expect(yield* submitUrls(urlsOf(2))).toEqual({
        failure: Option.none(),
        stopped: true,
        submittedUrls: [],
      });
      expect(fetcher).toHaveBeenCalledOnce();
    })
  );

  it.effect("reports a typed failure when a quota answer is not JSON", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(
        answer(400, "Quota remaining for today: 30")
      );

      const outcome = yield* submitUrls(urlsOf(2));

      expect(outcome.submittedUrls).toEqual([]);
      expect(Option.getOrUndefined(outcome.failure)).toMatchObject({
        _tag: "BingSubmitError",
        message: "Failed to decode Bing quota response.",
      });
    })
  );

  it.effect(
    "keeps the URLs accepted before a status that is neither 200 nor a quota message, then reports that status",
    () =>
      Effect.gen(function* () {
        const urls = urlsOf(150);
        fetcher
          .mockResolvedValueOnce(answer(200))
          .mockResolvedValueOnce(answer(500, "Internal error"));
        const fiber = yield* Effect.forkChild(submitUrls(urls));

        yield* TestClock.adjust("1 second");

        const outcome = yield* Fiber.join(fiber);
        expect(outcome.submittedUrls).toEqual(Arr.take(urls, 100));
        expect(Option.getOrUndefined(outcome.failure)).toMatchObject({
          _tag: "BingSubmitError",
          cause: 500,
          message: "Bing failed with HTTP 500.",
        });
      })
  );

  it.effect.each([400, 503])(
    "reports the status of a %i answer that is not a quota message",
    (status) =>
      Effect.gen(function* () {
        fetcher.mockResolvedValueOnce(answer(status, "Invalid request"));

        const outcome = yield* submitUrls(urlsOf(2));

        expect(outcome.submittedUrls).toEqual([]);
        expect(Option.getOrUndefined(outcome.failure)).toMatchObject({
          _tag: "BingSubmitError",
          cause: status,
        });
      })
  );

  it.effect(
    "keeps the URLs accepted before a transport error, then reports the error",
    () =>
      Effect.gen(function* () {
        const urls = urlsOf(150);
        fetcher
          .mockResolvedValueOnce(answer(200))
          .mockRejectedValueOnce(new TypeError("fetch failed"));
        const fiber = yield* Effect.forkChild(submitUrls(urls));

        yield* TestClock.adjust("1 second");

        const outcome = yield* Fiber.join(fiber);
        expect(outcome.submittedUrls).toEqual(Arr.take(urls, 100));
        expect(Option.getOrUndefined(outcome.failure)).toMatchObject({
          _tag: "BingSubmitError",
          message: "Error submitting URLs to Bing.",
        });
      })
  );

  it.effect(
    "reports a typed failure when the response body cannot be read",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValueOnce(brokenBody());

        const outcome = yield* submitUrls(urlsOf(2));

        expect(outcome.submittedUrls).toEqual([]);
        expect(Option.getOrUndefined(outcome.failure)).toMatchObject({
          _tag: "BingSubmitError",
          message: "Failed to read Bing response text.",
        });
      })
  );

  it.effect(
    "reports a deadline when the response body never ends, at 10 s",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValueOnce(neverEndingBody());
        const fiber = yield* Effect.forkChild(submitUrls(urlsOf(2)));

        yield* TestClock.adjust("10 seconds");

        const outcome = yield* Fiber.join(fiber);
        expect(outcome.submittedUrls).toEqual([]);
        expect(Option.getOrUndefined(outcome.failure)).toMatchObject({
          _tag: "BingSubmitError",
          cause: "deadline",
          message: "Bing did not answer within 10 seconds.",
        });
      })
  );
});
