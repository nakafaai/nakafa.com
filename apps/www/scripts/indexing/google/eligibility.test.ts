// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { FetchClient } from "@repo/utilities/http/client";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect, Fiber } from "effect";
import { FetchHttpClient } from "effect/http";
import { TestClock } from "effect/testing";
import { getEligibleGoogleIndexingUrls } from "@/scripts/indexing/google/eligibility";

const JOB_POSTING = encodeJsonText({
  "@context": "https://schema.org",
  "@type": "JobPosting",
  title: "Teacher",
});
const ARTICLE = encodeJsonText({
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Vektor",
});
const LIVE_VIDEO = encodeJsonText({
  "@context": "https://schema.org",
  "@type": "VideoObject",
  publication: { "@type": "BroadcastEvent", isLiveBroadcast: true },
});
const urlA = "https://nakafa.com/id/job";
const urlB = "https://nakafa.com/id/article";
const urlC = "https://nakafa.com/id/live";
/** One fetch double for the whole file, provided to the module's own client. */
const fetcher = vi.fn<typeof fetch>();

beforeEach(() => {
  fetcher.mockReset();
});

/** An HTML page that holds each JSON-LD text in its own script element. */
function htmlPage(...jsonLd: string[]) {
  const scripts = Arr.map(
    jsonLd,
    (block) => `<script type="application/ld+json">${block}</script>`
  );
  return `<html><head>${Arr.join(scripts, "")}</head><body></body></html>`;
}

/** A 2xx answer with the given body text. */
const page = (html: string) => new Response(html, { status: 200 });

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

/** Answers each page request with the HTML registered for its URL. */
function answerFrom(pages: Readonly<Record<string, string>>) {
  fetcher.mockImplementation(async (input) => page(pages[String(input)] ?? ""));
}

/** A request answer that the test settles by hand, after the module asks for it. */
function pendingAnswer() {
  let respond: (response: Response) => void = () => undefined;
  const promise = new Promise<Response>((resolve) => {
    respond = resolve;
  });
  return { promise, respond };
}

/** Lets forked requests start or finish, until each one waits on a test answer. */
const settle = Effect.yieldNow.pipe(
  Effect.andThen(Effect.yieldNow),
  Effect.andThen(Effect.yieldNow)
);

/** Lists the eligible URLs of one batch through the module's own client and this file's fetch double. */
function listEligible(urls: string[]) {
  return getEligibleGoogleIndexingUrls({ batchIndex: 1, urls }).pipe(
    Effect.provide(FetchClient),
    Effect.provideService(FetchHttpClient.Fetch, fetcher)
  );
}

describe("getEligibleGoogleIndexingUrls", () => {
  it.effect(
    "keeps the URLs whose live JSON-LD is API-eligible, in sitemap order",
    () =>
      Effect.gen(function* () {
        answerFrom({
          [urlA]: htmlPage(JOB_POSTING),
          [urlB]: htmlPage(ARTICLE),
          [urlC]: htmlPage(LIVE_VIDEO),
        });

        expect(yield* listEligible([urlA, urlB, urlC])).toEqual([urlA, urlC]);
        expect(fetcher).toHaveBeenCalledTimes(3);
      })
  );

  it.effect("treats a page without JSON-LD as not eligible", () =>
    Effect.gen(function* () {
      answerFrom({ [urlA]: htmlPage() });

      expect(yield* listEligible([urlA])).toEqual([]);
    })
  );

  it.effect(
    "skips an empty JSON-LD block and reads the next block of the page",
    () =>
      Effect.gen(function* () {
        answerFrom({ [urlA]: htmlPage("   ", ARTICLE, JOB_POSTING) });

        expect(yield* listEligible([urlA])).toEqual([urlA]);
      })
  );

  it.effect("fails with a parse error when a JSON-LD block is malformed", () =>
    Effect.gen(function* () {
      answerFrom({ [urlA]: htmlPage('{"@type": ') });

      expect(yield* listEligible([urlA]).pipe(Effect.flip)).toMatchObject({
        _tag: "GoogleStructuredDataParseError",
        message: `Failed to parse JSON-LD while checking ${urlA}.`,
        url: urlA,
      });
    })
  );

  it.effect(
    "pins today's rule: one page answered outside 2xx fails the whole batch",
    () =>
      Effect.gen(function* () {
        fetcher.mockImplementation(async (input) =>
          String(input) === urlB
            ? new Response("", { status: 500 })
            : page(htmlPage(JOB_POSTING))
        );

        expect(
          yield* listEligible([urlA, urlB]).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "GoogleIndexPageFetchError",
          message: "Google Indexing API eligibility fetch returned HTTP 500.",
          url: urlB,
        });
      })
  );

  it.effect("fails with a fetch error when a page request is rejected", () =>
    Effect.gen(function* () {
      fetcher.mockRejectedValueOnce(new TypeError("fetch failed"));

      expect(yield* listEligible([urlA]).pipe(Effect.flip)).toMatchObject({
        _tag: "GoogleIndexPageFetchError",
        message: `Failed to fetch ${urlA} for Google Indexing API eligibility.`,
        url: urlA,
      });
    })
  );

  it.effect("fails with a read error when a page body cannot be read", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(brokenBody());

      expect(yield* listEligible([urlA]).pipe(Effect.flip)).toMatchObject({
        _tag: "GoogleIndexPageFetchError",
        message: `Failed to read ${urlA} for Google Indexing API eligibility.`,
        url: urlA,
      });
    })
  );

  it.effect(
    "fails with a deadline when one page never answers, at 10 s, while the other page is read",
    () =>
      Effect.gen(function* () {
        fetcher.mockImplementation(async (input) =>
          String(input) === urlA
            ? new Promise<Response>(() => undefined)
            : page(htmlPage(JOB_POSTING))
        );
        const fiber = yield* Effect.forkChild(
          listEligible([urlA, urlB]).pipe(Effect.flip)
        );

        yield* TestClock.adjust("10 seconds");

        expect(yield* Fiber.join(fiber)).toMatchObject({
          _tag: "GoogleIndexPageFetchError",
          cause: "deadline",
          url: urlA,
        });
      })
  );

  it.effect("keeps at most 8 page requests open at once", () =>
    Effect.gen(function* () {
      const urls = Arr.makeBy(
        10,
        (index) => `https://nakafa.com/id/page-${index}`
      );
      const answers = Arr.makeBy(urls.length, () => pendingAnswer());
      for (const answer of answers) {
        fetcher.mockImplementationOnce(() => answer.promise);
      }
      const fiber = yield* Effect.forkChild(listEligible(urls));

      yield* settle;
      expect(fetcher).toHaveBeenCalledTimes(8);

      // One answer frees a slot, so the ninth request starts.
      answers[0]?.respond(page(""));
      yield* settle;
      expect(fetcher).toHaveBeenCalledTimes(9);

      for (const answer of answers) {
        answer.respond(page(""));
      }
      expect(yield* Fiber.join(fiber)).toEqual([]);
    })
  );
});
