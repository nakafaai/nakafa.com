// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { FetchClient } from "@repo/utilities/http/client";
import { Array as Arr, Effect, Fiber, Option, Schema } from "effect";
import { FetchHttpClient } from "effect/http";
import { TestClock } from "effect/testing";
import { submitUrlsToGoogle } from "@/scripts/indexing/google/submit";

const PUBLISH_ENDPOINT =
  "https://indexing.googleapis.com/v3/urlNotifications:publish";
const ACCESS_TOKEN = "test-access-token";
const PublishBodySchema = Schema.fromJsonString(
  Schema.Struct({ type: Schema.String, url: Schema.String })
);
const firstUrl = "https://nakafa.com/id/first";
const secondUrl = "https://nakafa.com/id/second";
const thirdUrl = "https://nakafa.com/id/third";
/** One fetch double for the whole file, provided to the module's own client. */
const fetcher = vi.fn<typeof fetch>();

beforeEach(() => {
  fetcher.mockReset();
});

/** The acknowledgement that Google sends for an accepted URL. */
const accepted = () => new Response("{}", { status: 200 });
/** A refused answer with the given status and body text. */
const refused = (status: number, body = "") => new Response(body, { status });
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

/** A submission that finished without a failure or a stop, and accepted these URLs. */
const noFailure = (submittedUrls: string[]) => ({
  failure: Option.none(),
  stopped: false,
  submittedUrls,
});

/** A submission that a stop status ended, after it accepted these URLs. */
const stoppedAfter = (submittedUrls: string[]) => ({
  failure: Option.none(),
  stopped: true,
  submittedUrls,
});

/** Submits URLs through the module's own client and this file's fetch double. */
function submitUrls(urls: string[]) {
  return submitUrlsToGoogle(urls, ACCESS_TOKEN).pipe(
    Effect.provide(FetchClient),
    Effect.provideService(FetchHttpClient.Fetch, fetcher)
  );
}

/** Submits URLs while the test clock passes every wait between the requests. */
function submitAll(urls: string[]) {
  return Effect.gen(function* () {
    const fiber = yield* Effect.forkChild(submitUrls(urls));
    yield* TestClock.adjust("1 minute");
    return yield* Fiber.join(fiber);
  });
}

/** Builds n distinct canonical URLs for one submission. */
function urlsOf(count: number) {
  return Arr.makeBy(count, (index) => `https://nakafa.com/id/page-${index}`);
}

describe("submitUrlsToGoogle", () => {
  it.effect("sends nothing for an empty URL list", () =>
    Effect.gen(function* () {
      expect(yield* submitUrls([])).toEqual(noFailure([]));
      expect(fetcher).not.toHaveBeenCalled();
    })
  );

  it.effect("sends one publish request per URL and counts a 200", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(accepted());

      expect(yield* submitUrls([firstUrl])).toEqual(noFailure([firstUrl]));
      expect(fetcher).toHaveBeenCalledOnce();
      const [input, init] = fetcher.mock.calls[0] ?? [];
      expect(String(input)).toBe(PUBLISH_ENDPOINT);
      expect(init?.method).toBe("POST");
      expect(new Headers(init?.headers).get("authorization")).toBe(
        `Bearer ${ACCESS_TOKEN}`
      );
      expect(
        yield* Schema.decodeEffect(PublishBodySchema)(String(init?.body))
      ).toEqual({ type: "URL_UPDATED", url: firstUrl });
    })
  );

  it.effect(
    "stops the run at a 429 and returns the URLs accepted before it",
    () =>
      Effect.gen(function* () {
        fetcher
          .mockResolvedValueOnce(accepted())
          .mockResolvedValueOnce(refused(429))
          .mockResolvedValueOnce(accepted());

        expect(yield* submitAll([firstUrl, secondUrl, thirdUrl])).toEqual(
          stoppedAfter([firstUrl])
        );
        expect(fetcher).toHaveBeenCalledTimes(2);
      })
  );

  it.effect.each([401, 403])(
    "stops the run at a %i answer without sending the next URL",
    (status) =>
      Effect.gen(function* () {
        fetcher.mockResolvedValueOnce(refused(status));

        expect(yield* submitAll([firstUrl, secondUrl])).toEqual(
          stoppedAfter([])
        );
        expect(fetcher).toHaveBeenCalledOnce();
      })
  );

  it.effect.each([
    "Quota exceeded for this project",
    "Usage LIMIT EXCEEDED today",
  ])("stops the run at a 500 whose body names a limit: %s", (body) =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(refused(500, body));

      expect(yield* submitAll([firstUrl, secondUrl])).toEqual(stoppedAfter([]));
      expect(fetcher).toHaveBeenCalledOnce();
    })
  );

  it.effect(
    "counts a 500 as a failure of that URL and sends the next URL after waits of 2 s and 4 s",
    () =>
      Effect.gen(function* () {
        fetcher
          .mockResolvedValueOnce(refused(500))
          .mockResolvedValueOnce(refused(500))
          .mockResolvedValueOnce(accepted());
        const fiber = yield* Effect.forkChild(
          submitUrls([firstUrl, secondUrl, thirdUrl])
        );

        yield* TestClock.adjust("1999 millis");
        expect(fetcher).toHaveBeenCalledTimes(1);
        yield* TestClock.adjust("1 millis");
        expect(fetcher).toHaveBeenCalledTimes(2);
        yield* TestClock.adjust("3999 millis");
        expect(fetcher).toHaveBeenCalledTimes(2);
        yield* TestClock.adjust("1 millis");
        expect(fetcher).toHaveBeenCalledTimes(3);
        expect(yield* Fiber.join(fiber)).toEqual(noFailure([thirdUrl]));
      })
  );

  it.effect(
    "waits 2 s after a 500, then returns to a 1 s wait after an accepted URL",
    () =>
      Effect.gen(function* () {
        fetcher
          .mockResolvedValueOnce(refused(500))
          .mockResolvedValueOnce(accepted())
          .mockResolvedValueOnce(accepted());
        const fiber = yield* Effect.forkChild(
          submitUrls([firstUrl, secondUrl, thirdUrl])
        );

        yield* TestClock.adjust("1999 millis");
        expect(fetcher).toHaveBeenCalledTimes(1);
        yield* TestClock.adjust("1 millis");
        expect(fetcher).toHaveBeenCalledTimes(2);
        yield* TestClock.adjust("999 millis");
        expect(fetcher).toHaveBeenCalledTimes(2);
        yield* TestClock.adjust("1 millis");
        expect(fetcher).toHaveBeenCalledTimes(3);
        expect(yield* Fiber.join(fiber)).toEqual(
          noFailure([secondUrl, thirdUrl])
        );
      })
  );

  it.effect("caps the wait at 30 s after repeated 500 answers", () =>
    Effect.gen(function* () {
      fetcher.mockImplementation(async () => refused(500));
      const fiber = yield* Effect.forkChild(submitUrls(urlsOf(6)));

      // The waits are 2, 4, 8, and 16 seconds, so the fifth request starts at 30 s.
      yield* TestClock.adjust("29999 millis");
      expect(fetcher).toHaveBeenCalledTimes(4);
      yield* TestClock.adjust("1 millis");
      expect(fetcher).toHaveBeenCalledTimes(5);
      // The fifth wait is 30 s, not 32 s, so the sixth request starts at 60 s.
      yield* TestClock.adjust("29999 millis");
      expect(fetcher).toHaveBeenCalledTimes(5);
      yield* TestClock.adjust("1 millis");
      expect(fetcher).toHaveBeenCalledTimes(6);
      expect(yield* Fiber.join(fiber)).toEqual(noFailure([]));
    })
  );

  it.effect(
    "waits 1 s between accepted URLs and does not wait after the last one",
    () =>
      Effect.gen(function* () {
        fetcher.mockImplementation(async () => accepted());
        const fiber = yield* Effect.forkChild(
          submitUrls([firstUrl, secondUrl])
        );

        yield* TestClock.adjust("999 millis");
        expect(fetcher).toHaveBeenCalledTimes(1);
        yield* TestClock.adjust("1 millis");
        expect(fetcher).toHaveBeenCalledTimes(2);
        expect(yield* Fiber.join(fiber)).toEqual(
          noFailure([firstUrl, secondUrl])
        );
      })
  );

  it.effect("reports a deadline when a response body never ends, at 10 s", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(neverEndingBody());
      const fiber = yield* Effect.forkChild(submitUrls([firstUrl]));

      yield* TestClock.adjust("10 seconds");

      const outcome = yield* Fiber.join(fiber);
      expect(outcome.submittedUrls).toEqual([]);
      expect(Option.getOrUndefined(outcome.failure)).toMatchObject({
        _tag: "GoogleIndexSubmitError",
        cause: "deadline",
        message: `Submitting ${firstUrl} did not answer within 10 seconds.`,
      });
      expect(fetcher).toHaveBeenCalledOnce();
    })
  );

  it.effect(
    "reports the typed error when the request is rejected, and sends no later URL",
    () =>
      Effect.gen(function* () {
        fetcher.mockRejectedValueOnce(new TypeError("fetch failed"));

        const outcome = yield* submitUrls([firstUrl, secondUrl]);

        expect(outcome.submittedUrls).toEqual([]);
        expect(Option.getOrUndefined(outcome.failure)).toMatchObject({
          _tag: "GoogleIndexSubmitError",
          message: `Network error submitting ${firstUrl}.`,
        });
        expect(fetcher).toHaveBeenCalledOnce();
      })
  );

  it.effect(
    "reports a typed error when the acknowledgement body cannot be read",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValueOnce(brokenBody());

        const outcome = yield* submitUrls([firstUrl]);

        expect(outcome.submittedUrls).toEqual([]);
        expect(Option.getOrUndefined(outcome.failure)).toMatchObject({
          _tag: "GoogleIndexSubmitError",
          message: `Failed to read the Indexing API response for ${firstUrl}.`,
        });
      })
  );

  it.effect(
    "keeps the URL accepted before a deadline, and reports the deadline as the failure",
    () =>
      Effect.gen(function* () {
        fetcher
          .mockResolvedValueOnce(accepted())
          .mockResolvedValueOnce(neverEndingBody());
        const fiber = yield* Effect.forkChild(
          submitUrls([firstUrl, secondUrl])
        );

        // The first URL is accepted, then the 1 s wait ends and the second request starts.
        yield* TestClock.adjust("1 second");
        yield* TestClock.adjust("10 seconds");

        const outcome = yield* Fiber.join(fiber);
        expect(outcome.submittedUrls).toEqual([firstUrl]);
        expect(Option.getOrUndefined(outcome.failure)).toMatchObject({
          _tag: "GoogleIndexSubmitError",
          cause: "deadline",
        });
        expect(fetcher).toHaveBeenCalledTimes(2);
      })
  );
});
