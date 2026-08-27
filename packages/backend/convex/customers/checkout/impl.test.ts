import { describe, expect, it } from "@effect/vitest";
import { validateCheckoutRequest } from "@repo/backend/convex/customers/checkout/impl";
import { InvalidCheckoutSuccessUrl } from "@repo/backend/convex/customers/checkout/spec";
import { products } from "@repo/backend/convex/utils/polar/products";
import { siteOrigin } from "@repo/backend/convex/utils/site";
import { Effect } from "effect";

describe("customers/checkout/impl", () => {
  it.effect("keeps allowed product IDs and same-origin success URLs", () =>
    Effect.gen(function* () {
      const productId = products.pro.id;
      const successUrl = `${siteOrigin}/en/home`;
      const request = yield* validateCheckoutRequest({
        locale: "en",
        successUrl,
      });
      expect(request).toEqual({
        locale: "en",
        polarLocale: "en",
        primaryProductId: productId,
        productIds: [productId],
        successUrl,
      });
    })
  );
  it.effect(
    "keeps Indonesian app locale separate from Polar checkout language",
    () =>
      Effect.gen(function* () {
        const productId = products.pro.id;
        const successUrl = `${siteOrigin}/id/home`;
        const request = yield* validateCheckoutRequest({
          locale: "id",
          successUrl,
        });
        expect(request).toEqual({
          locale: "id",
          polarLocale: "en",
          primaryProductId: productId,
          productIds: [productId],
          successUrl,
        });
      })
  );
  it.effect("uses German for a German checkout", () =>
    Effect.gen(function* () {
      const productId = products.pro.id;
      const successUrl = `${siteOrigin}/de/home`;
      const request = yield* validateCheckoutRequest({
        locale: "de",
        successUrl,
      });
      expect(request).toEqual({
        locale: "de",
        polarLocale: "de",
        primaryProductId: productId,
        productIds: [productId],
        successUrl,
      });
    })
  );
  it.effect("rejects off-site success URLs", () =>
    Effect.gen(function* () {
      const failure = yield* validateCheckoutRequest({
        locale: "en",
        successUrl: "https://example.com/en/home",
      }).pipe(Effect.flip);
      expect(failure).toBeInstanceOf(InvalidCheckoutSuccessUrl);
    })
  );
  it.effect("rejects malformed success URLs", () =>
    Effect.gen(function* () {
      const failure = yield* validateCheckoutRequest({
        locale: "en",
        successUrl: "not-a-url",
      }).pipe(Effect.flip);
      expect(failure).toBeInstanceOf(InvalidCheckoutSuccessUrl);
    })
  );
});
