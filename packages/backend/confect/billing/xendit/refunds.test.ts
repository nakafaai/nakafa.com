import { beforeEach, describe, expect, it } from "@effect/vitest";
import { createRefund } from "@repo/backend/confect/billing/xendit/refunds";
import { Effect, Schema } from "effect";
import { FetchHttpClient } from "effect/http";

/** The fetch that Effect's client calls in place of the global one. */
const fetcher = vi.fn<typeof fetch>();

/** The JSON text of one body. */
const encodeJson = Schema.encodeUnknownSync(
  Schema.fromJsonString(Schema.Unknown)
);

const REFUND = {
  amount: 59_000,
  currency: "IDR",
  payment_id: "py_1",
  reason: "CANCELLATION",
  reference_id: "pack-py_1",
} as const;

describe("billing/xendit/refunds", () => {
  beforeEach(() => {
    fetcher.mockReset();
    vi.stubEnv("XENDIT_API_KEY", "test-secret");
  });

  it.effect(
    "asks for a refund with a POST and the documented API version",
    () =>
      Effect.gen(function* () {
        // The body Xendit Test Mode answered on 1 Nov 2026.
        fetcher.mockResolvedValue(
          new Response(
            encodeJson({
              amount: 59_000,
              business_id: "biz_1",
              channel_code: "CARDS",
              created: "2026-11-01T08:17:16.930Z",
              currency: "IDR",
              payment_id: "py_1",
              reason: "CANCELLATION",
              reference_id: "pack-py_1",
              refund_id: "rfd-1",
              status: "SUCCEEDED",
              updated: "2026-11-01T08:17:16.930Z",
            }),
            { headers: { "content-type": "application/json" }, status: 201 }
          )
        );
        const refund = yield* createRefund(REFUND).pipe(
          Effect.provideService(FetchHttpClient.Fetch, fetcher)
        );
        const [url, init] = fetcher.mock.calls[0] ?? [];
        expect(refund.refund_id).toBe("rfd-1");
        expect(init?.method).toBe("POST");
        expect(String(url)).toBe("https://api.xendit.co/v3/refunds");
        expect(new Headers(init?.headers).get("api-version")).toBe(
          "2024-11-11"
        );
      })
  );

  it.effect(
    "refuses to send a refund that breaks the contract, before any call",
    () =>
      Effect.gen(function* () {
        const refused = yield* createRefund({
          ...REFUND,
          amount: Number.NaN,
        }).pipe(
          Effect.provideService(FetchHttpClient.Fetch, fetcher),
          Effect.flip
        );
        expect(refused).toMatchObject({ errorCode: "REQUEST_NOT_ENCODABLE" });
        expect(fetcher).not.toHaveBeenCalled();
      })
  );
});
