import { validateCheckoutRequest } from "@repo/backend/convex/customers/checkout/impl";
import { InvalidCheckoutSuccessUrl } from "@repo/backend/convex/customers/checkout/spec";
import { products } from "@repo/backend/convex/utils/polar/products";
import { siteOrigin } from "@repo/backend/convex/utils/site";
import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

describe("customers/checkout/impl", () => {
  it("keeps allowed product IDs and same-origin success URLs", async () => {
    const productId = products.pro.id;
    const successUrl = `${siteOrigin}/en/home`;

    const request = await Effect.runPromise(
      validateCheckoutRequest({
        locale: "en",
        successUrl,
      })
    );

    expect(request).toEqual({
      locale: "en",
      polarLocale: "en",
      primaryProductId: productId,
      productIds: [productId],
      successUrl,
    });
  });

  it("keeps Indonesian app locale separate from Polar checkout language", async () => {
    const productId = products.pro.id;
    const successUrl = `${siteOrigin}/id/home`;

    const request = await Effect.runPromise(
      validateCheckoutRequest({
        locale: "id",
        successUrl,
      })
    );

    expect(request).toEqual({
      locale: "id",
      polarLocale: "en",
      primaryProductId: productId,
      productIds: [productId],
      successUrl,
    });
  });

  it("rejects off-site success URLs", async () => {
    const result = await Effect.runPromise(
      Effect.either(
        validateCheckoutRequest({
          locale: "en",
          successUrl: "https://example.com/en/home",
        })
      )
    );

    if (Either.isRight(result)) {
      throw new Error("Expected off-site success URL to fail.");
    }

    expect(result.left).toBeInstanceOf(InvalidCheckoutSuccessUrl);
  });

  it("rejects malformed success URLs", async () => {
    const result = await Effect.runPromise(
      Effect.either(
        validateCheckoutRequest({
          locale: "en",
          successUrl: "not-a-url",
        })
      )
    );

    if (Either.isRight(result)) {
      throw new Error("Expected malformed success URL to fail.");
    }

    expect(result.left).toBeInstanceOf(InvalidCheckoutSuccessUrl);
  });
});
