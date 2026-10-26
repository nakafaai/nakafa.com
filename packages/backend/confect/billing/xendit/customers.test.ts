import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  ensureCustomer,
  findCustomer,
} from "@repo/backend/confect/billing/xendit/customers";
import { Effect, Option, Schema } from "effect";
import { FetchHttpClient } from "effect/http";

/** The fetch that Effect's client calls in place of the global one. */
const fetcher = vi.fn<typeof fetch>();

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

const ADA = {
  email: "ada@example.com",
  individual_detail: { given_names: "Ada" },
  reference_id: "auth-ada",
  type: "INDIVIDUAL",
} as const;

/** The request the client sent for one fetch call. */
function sent(index: number) {
  const [input, init] = fetcher.mock.calls[index] ?? [];
  return new Request(String(input), init);
}

describe("billing/xendit/customers", () => {
  beforeEach(() => {
    fetcher.mockReset();
    vi.stubEnv("XENDIT_API_KEY", "test-secret");
  });

  it.effect(
    "finds the customer Xendit holds under a reference, and none when it holds none",
    () =>
      Effect.gen(function* () {
        fetcher
          .mockResolvedValueOnce(
            answer(200, { data: [{ id: "cust-1", reference_id: "auth-ada" }] })
          )
          .mockResolvedValueOnce(answer(200, { data: [] }));
        const found = yield* findCustomer("auth-ada").pipe(
          Effect.provideService(FetchHttpClient.Fetch, fetcher)
        );
        const missing = yield* findCustomer("auth-nobody").pipe(
          Effect.provideService(FetchHttpClient.Fetch, fetcher)
        );
        expect(found).toStrictEqual(
          Option.some({ id: "cust-1", reference_id: "auth-ada" })
        );
        expect(missing).toStrictEqual(Option.none());
        const url = new URL(sent(0).url);
        expect(url.pathname).toBe("/customers");
        expect(url.searchParams.get("reference_id")).toBe("auth-ada");
        expect(sent(0).headers.get("api-version")).toBe("2020-10-31");
      })
  );

  it.effect(
    "reuses the customer Xendit already holds, and creates one only when it holds none",
    () =>
      Effect.gen(function* () {
        fetcher
          .mockResolvedValueOnce(
            answer(200, { data: [{ id: "cust-1", reference_id: "auth-ada" }] })
          )
          .mockResolvedValueOnce(answer(200, { data: [] }))
          .mockResolvedValueOnce(
            answer(201, { id: "cust-2", reference_id: "auth-ada" })
          );
        const reused = yield* ensureCustomer(ADA).pipe(
          Effect.provideService(FetchHttpClient.Fetch, fetcher)
        );
        const created = yield* ensureCustomer(ADA).pipe(
          Effect.provideService(FetchHttpClient.Fetch, fetcher)
        );
        expect(reused).toBe("cust-1");
        expect(created).toBe("cust-2");
        expect(fetcher).toHaveBeenCalledTimes(3);
        expect(sent(2).method).toBe("POST");
        expect(yield* Effect.promise(() => sent(2).json())).toStrictEqual(ADA);
      })
  );

  it.effect(
    "refuses to send a customer that breaks the Xendit contract, before any call",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValueOnce(answer(200, { data: [] }));
        const failure = yield* ensureCustomer({
          ...ADA,
          reference_id: "",
        }).pipe(
          Effect.provideService(FetchHttpClient.Fetch, fetcher),
          Effect.flip
        );
        expect(failure).toMatchObject({
          _tag: "XenditRequestFailed",
          errorCode: "REQUEST_NOT_ENCODABLE",
        });
        expect(fetcher).toHaveBeenCalledOnce();
      })
  );
});
