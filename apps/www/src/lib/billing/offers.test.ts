// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import billing from "@repo/backend/confect/_generated/refs/billing";
import { Effect, Layer } from "effect";
import { readProOffers } from "@/lib/billing/offers";

/** The Convex answer of the offers read, chosen by each test. */
const queryMock = vi.hoisted(() => vi.fn());
vi.mock("@confect/js", async (importOriginal) => {
  const { HttpClient } = await importOriginal<typeof import("@confect/js")>();
  return {
    HttpClient: {
      ...HttpClient,
      layer: (...args: Parameters<typeof HttpClient.layer>) =>
        Layer.effect(
          HttpClient.HttpClient,
          Effect.gen(function* () {
            const client = yield* HttpClient.HttpClient;
            return { ...client, query: queryMock };
          })
        ).pipe(Layer.provide(HttpClient.layer(...args))),
    },
  };
});

const OFFERS = [
  { amount: 79_000, currency: "IDR", months: 1, offer: "pro.monthly" },
  { amount: 79_000, currency: "IDR", months: 1, offer: "pro.pass.1" },
  { amount: 229_000, currency: "IDR", months: 3, offer: "pro.pass.3" },
] as const;

describe("billing/offers", () => {
  it.effect(
    "reads the offers of the shown currency, and only the passes for a pass holder",
    () =>
      Effect.gen(function* () {
        queryMock.mockReturnValue(Effect.succeed(OFFERS));
        expect(yield* readProOffers("IDR", false)).toEqual(OFFERS);
        expect(queryMock).toHaveBeenCalledWith(billing.queries.proOffers, {
          currency: "IDR",
        });
        expect(yield* readProOffers("IDR", true)).toEqual([
          OFFERS[1],
          OFFERS[2],
        ]);
      })
  );
});
