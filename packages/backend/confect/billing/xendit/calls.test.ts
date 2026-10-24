import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  deactivatePlan,
  getPlan,
} from "@repo/backend/confect/billing/xendit/plans";
import { createSession } from "@repo/backend/confect/billing/xendit/sessions";
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

describe("billing/xendit calls", () => {
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

  it.effect(
    "opens a subscription checkout and returns its payment link and plan",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValue(
          ok({
            payment_id: null,
            payment_link_url: "https://xen.to/checkout",
            payment_session_id: "ps-1",
            payment_token_id: null,
            recurring_plan_id: "repl_1",
            reference_id: "billing-1",
            session_type: "SUBSCRIPTION",
            status: "ACTIVE",
          })
        );
        const session = yield* createSession({
          amount: 79_000,
          country: "ID",
          currency: "IDR",
          mode: "PAYMENT_LINK",
          reference_id: "billing-1",
          session_type: "SUBSCRIPTION",
          subscription: {
            schedule: {
              anchor_date: "2026-11-01T00:00:00+00:00",
              interval: "MONTH",
              interval_count: 1,
            },
          },
        }).pipe(Effect.provideService(FetchHttpClient.Fetch, fetcher));
        const [, init] = fetcher.mock.calls[0] ?? [];
        expect(session).toMatchObject({
          payment_link_url: "https://xen.to/checkout",
          recurring_plan_id: "repl_1",
        });
        expect(init?.method).toBe("POST");
        const sent = yield* Schema.decodeEffect(
          Schema.fromJsonString(Schema.Struct({ reference_id: Schema.String }))
        )(String(init?.body));
        expect(sent).toEqual({ reference_id: "billing-1" });
      })
  );
});
