import { validateCheckoutRequest } from "@repo/backend/convex/customers/checkout/impl";
import {
  InvalidCheckoutProductSelection,
  InvalidCheckoutSuccessUrl,
} from "@repo/backend/convex/customers/checkout/spec";
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
        productIds: [productId],
        successUrl,
      })
    );

    expect(request).toEqual({
      primaryProductId: productId,
      productIds: [productId],
      successUrl,
    });
  });

  it("rejects empty product selections", async () => {
    const result = await Effect.runPromise(
      Effect.either(
        validateCheckoutRequest({
          productIds: [],
          successUrl: `${siteOrigin}/en/home`,
        })
      )
    );

    if (Either.isRight(result)) {
      throw new Error("Expected empty product selection to fail.");
    }

    expect(result.left).toBeInstanceOf(InvalidCheckoutProductSelection);
  });

  it("rejects unsupported product IDs", async () => {
    const result = await Effect.runPromise(
      Effect.either(
        validateCheckoutRequest({
          productIds: ["unsupported-product"],
          successUrl: `${siteOrigin}/en/home`,
        })
      )
    );

    if (Either.isRight(result)) {
      throw new Error("Expected unsupported product selection to fail.");
    }

    expect(result.left).toBeInstanceOf(InvalidCheckoutProductSelection);
  });

  it("rejects off-site success URLs", async () => {
    const result = await Effect.runPromise(
      Effect.either(
        validateCheckoutRequest({
          productIds: [products.pro.id],
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
          productIds: [products.pro.id],
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
