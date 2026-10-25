import { beforeEach, describe, expect, it } from "@effect/vitest";
import { createSession } from "@repo/backend/confect/billing/xendit/sessions";
import { Effect, Schema } from "effect";
import { FetchHttpClient } from "effect/http";

/** The fetch that Effect's client calls in place of the global one. */
const fetcher = vi.fn<typeof fetch>();

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

describe("billing/xendit/sessions", () => {
  beforeEach(() => {
    fetcher.mockReset();
    vi.stubEnv("XENDIT_API_KEY", "test-secret");
  });

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

  it.effect(
    "refuses to send a session that breaks the Xendit contract, before any call",
    () =>
      Effect.gen(function* () {
        fetcher.mockClear();
        const failure = yield* createSession({
          amount: 0,
          country: "ID",
          currency: "IDR",
          mode: "PAYMENT_LINK",
          reference_id: "billing-1",
          session_type: "PAY",
        }).pipe(
          Effect.flip,
          Effect.provideService(FetchHttpClient.Fetch, fetcher)
        );
        expect(failure).toMatchObject({
          _tag: "XenditRequestFailed",
          errorCode: "REQUEST_NOT_ENCODABLE",
        });
        expect(fetcher).not.toHaveBeenCalled();
      })
  );
});
