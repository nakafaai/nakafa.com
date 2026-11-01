import { afterEach, describe, expect, it } from "@effect/vitest";
import { attemptOf } from "@repo/backend/confect/integrations/attempt";
import { signBody } from "@repo/backend/confect/integrations/signature";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";

/** The fetch that one attempt calls, stubbed once for the file. */
const fetcher = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetcher);

afterEach(() => {
  fetcher.mockReset();
});

/** One attempt to a receiver on a public address, so the resolver stays out of it. */
const ATTEMPT = {
  attempt: 2,
  body: '{"id":"entry"}',
  event: "entry",
  secret: "secret",
  type: "unit.created",
  url: "https://93.184.216.34/hook",
};

/** The request that the attempt sent. */
const sent = () => {
  const [url, init] = fetcher.mock.calls[0] ?? [];
  return { headers: new Headers(init?.headers), init, url: String(url) };
};

describe("attemptOf", () => {
  it.effect(
    "posts the signed body, follows no redirect, and delivers on a 2xx",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValue(new Response(null, { status: 204 }));

        const outcome = yield* attemptOf(ATTEMPT);

        expect(outcome).toEqual({ code: 204, ms: 0, status: "delivered" });
        const { headers, init, url } = sent();
        expect(url).toBe(ATTEMPT.url);
        expect(init?.method).toBe("POST");
        expect(init?.redirect).toBe("manual");
        expect(headers.get("content-type")).toBe("application/json");
        expect(headers.get("nakafa-attempt")).toBe("2");
        expect(headers.get("nakafa-event")).toBe("entry");
        expect(headers.get("nakafa-event-type")).toBe("unit.created");
        expect(headers.get("nakafa-signature")).toBe(
          yield* signBody("secret", 0, ATTEMPT.body)
        );
      })
  );

  it.effect("fails on a redirect, which it never follows", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValue(Response.redirect("https://10.0.0.8/", 302));

      expect(yield* attemptOf(ATTEMPT)).toEqual({
        code: 302,
        ms: 0,
        reason: "status",
        status: "failed",
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
    })
  );

  it.effect(
    "fails with no request when the name resolves to a private address",
    () =>
      Effect.gen(function* () {
        fetcher.mockImplementation(() =>
          Promise.resolve(
            new Response(
              encodeJsonText({ Answer: [{ data: "10.0.0.8", type: 1 }] })
            )
          )
        );

        expect(
          yield* attemptOf({ ...ATTEMPT, url: "https://sekolah.example/hook" })
        ).toEqual({ code: null, ms: 0, reason: "address", status: "failed" });
        expect(fetcher).toHaveBeenCalledTimes(2);
      })
  );

  it.effect("fails when the receiver cannot be reached", () =>
    Effect.gen(function* () {
      fetcher.mockRejectedValue(new TypeError("fetch failed"));

      expect(yield* attemptOf(ATTEMPT)).toEqual({
        code: null,
        ms: 0,
        reason: "network",
        status: "failed",
      });
    })
  );

  it.effect("fails at its deadline when the receiver never answers", () =>
    Effect.gen(function* () {
      fetcher.mockImplementation(
        (_, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError"))
            );
          })
      );

      const fiber = yield* Effect.forkChild(attemptOf(ATTEMPT));
      yield* Effect.yieldNow;
      yield* TestClock.adjust("10 seconds");

      expect(yield* Fiber.join(fiber)).toEqual({
        code: null,
        ms: 10_000,
        reason: "deadline",
        status: "failed",
      });
    })
  );
});
