import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  deactivatePlan,
  getPlan,
} from "@repo/backend/confect/billing/xendit/plans";
import { Effect, Schema } from "effect";
import { FetchHttpClient } from "effect/http";

/** The fetch that Effect's client calls in place of the global one. */
const fetcher = vi.fn<typeof fetch>();

const PLAN_BODY = {
  amount: 79_000,
  created: "2026-10-24T00:00:00Z",
  currency: "IDR",
  customer_id: "cust-1",
  id: "repl_1",
  recurring_cycle_count: 0,
  reference_id: "billing-1",
  status: "INACTIVE",
  updated: "2026-10-24T00:00:00Z",
};

/** The JSON text of one answer body. */
const encodeJson = Schema.encodeUnknownSync(
  Schema.fromJsonString(Schema.Unknown)
);

/** A JSON answer with status 200. */
function ok(body: unknown) {
  return new Response(encodeJson(body), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
}

describe("billing/xendit/plans", () => {
  beforeEach(() => {
    fetcher.mockReset();
    vi.stubEnv("XENDIT_SECRET_KEY", "test-secret");
  });

  it.effect("reads a recurring plan with the documented API version", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValue(ok({ ...PLAN_BODY, status: "ACTIVE" }));
      const plan = yield* getPlan("repl_1").pipe(
        Effect.provideService(FetchHttpClient.Fetch, fetcher)
      );
      const [url, init] = fetcher.mock.calls[0] ?? [];
      expect(plan.status).toBe("ACTIVE");
      expect(init?.method).toBe("GET");
      expect(String(url)).toBe("https://api.xendit.co/recurring/plans/repl_1");
      expect(new Headers(init?.headers).get("api-version")).toBe("2026-01-01");
    })
  );

  it.effect(
    "deactivates a recurring plan with a POST to its deactivate path",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValue(ok(PLAN_BODY));
        const plan = yield* deactivatePlan("repl_1").pipe(
          Effect.provideService(FetchHttpClient.Fetch, fetcher)
        );
        const [url, init] = fetcher.mock.calls[0] ?? [];
        expect(plan.status).toBe("INACTIVE");
        expect(init?.method).toBe("POST");
        expect(String(url)).toBe(
          "https://api.xendit.co/recurring/plans/repl_1/deactivate"
        );
      })
  );
});
