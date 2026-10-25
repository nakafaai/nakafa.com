import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import {
  XenditDecodeFailed,
  XenditRequestFailed,
  xenditRequest,
} from "@repo/backend/confect/billing/xendit/client";
import { XenditPlan } from "@repo/backend/confect/billing/xendit/contract";
import { Effect, Schema } from "effect";
import { FetchHttpClient, HttpClientRequest } from "effect/http";

/** The fetch that Effect's client calls in place of the global one. */
const fetcher = vi.fn<typeof fetch>();

const PLAN_URL = "https://api.xendit.co/recurring/plans/repl_1";
const PLAN = {
  amount: 79_000,
  created: "2026-10-24T00:00:00Z",
  currency: "IDR",
  customer_id: "cust-1",
  id: "repl_1",
  recurring_cycle_count: 0,
  reference_id: "billing-1",
  status: "ACTIVE",
  updated: "2026-10-24T00:00:00Z",
};

/** Sends one plan read through the controlled fetch. */
function readPlan() {
  return xenditRequest(HttpClientRequest.get(PLAN_URL), XenditPlan).pipe(
    Effect.provideService(FetchHttpClient.Fetch, fetcher)
  );
}

/** The JSON text of one answer body. */
const encodeJson = Schema.encodeUnknownSync(
  Schema.fromJsonString(Schema.Unknown)
);

/** A JSON answer with one status. */
function answer(status: number, body: unknown) {
  return new Response(encodeJson(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

describe("billing/xendit/client", () => {
  beforeEach(() => {
    fetcher.mockReset();
    vi.stubEnv("XENDIT_API_KEY", "test-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.effect(
    "decodes a 2xx body and sends the secret key as basic credentials",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValue(answer(200, PLAN));
        const plan = yield* readPlan();
        const [, init] = fetcher.mock.calls[0] ?? [];
        expect(plan).toMatchObject({ id: "repl_1", status: "ACTIVE" });
        expect(new Headers(init?.headers).get("authorization")).toBe(
          `Basic ${btoa("test-secret:")}`
        );
      })
  );

  it.effect("fails with Xendit's error code on a non-2xx answer", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValue(
        answer(400, { error_code: "API_VALIDATION_ERROR", message: "bad plan" })
      );
      const error = yield* readPlan().pipe(Effect.flip);
      expect(error).toBeInstanceOf(XenditRequestFailed);
      expect(error).toMatchObject({
        errorCode: "API_VALIDATION_ERROR",
        message: "bad plan",
        status: 400,
      });
    })
  );

  it.effect(
    "names an unreadable failure body rather than dropping the status",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValue(
          new Response("upstream gone", { status: 502 })
        );
        const error = yield* readPlan().pipe(Effect.flip);
        expect(error).toMatchObject({ errorCode: "UNREADABLE", status: 502 });
      })
  );

  it.effect(
    "fails with a decode error when a 2xx body breaks the contract",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValue(answer(200, { id: "repl_1" }));
        const error = yield* readPlan().pipe(Effect.flip);
        expect(error).toBeInstanceOf(XenditDecodeFailed);
      })
  );

  it.effect("fails as no response when the network call itself fails", () =>
    Effect.gen(function* () {
      fetcher.mockRejectedValue(new TypeError("fetch failed"));
      const error = yield* readPlan().pipe(Effect.flip);
      expect(error).toMatchObject({ errorCode: "NO_RESPONSE", status: 0 });
    })
  );
});
