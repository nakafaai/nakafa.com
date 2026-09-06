import { describe, expect, it } from "@effect/vitest";
import { validateCheckoutRequest } from "@repo/backend/convex/customers/checkout/impl";
import { InvalidCheckoutSuccessUrl } from "@repo/backend/convex/customers/checkout/spec";
import { SiteConfigError } from "@repo/backend/convex/site/config";
import { products } from "@repo/backend/convex/utils/polar/products";
import { ConfigProvider, Effect } from "effect";

const siteOrigin = "http://localhost:3000";

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
  it.effect("rejects a missing site even for a localhost success URL", () =>
    Effect.gen(function* () {
      const failure = yield* validateCheckoutRequest({
        locale: "en",
        successUrl: `${siteOrigin}/en/home`,
      }).pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({})
        ),
        Effect.flip
      );

      expect(failure).toBeInstanceOf(SiteConfigError);
    })
  );
  it.effect("uses the current site configuration for checkout admission", () =>
    Effect.gen(function* () {
      const successUrl = "https://local.nakafa.com/en/home";
      const request = yield* validateCheckoutRequest({
        locale: "en",
        successUrl,
      }).pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({ SITE_URL: "https://local.nakafa.com" })
        )
      );

      expect(request.successUrl).toBe(successUrl);
    })
  );
});
