import { describe, expect, it } from "@effect/vitest";
import { AccountUnavailable } from "@repo/backend/confect/auth/spec";
import { CheckoutUnavailable } from "@repo/backend/confect/customers/checkout/spec";
import {
  getUnknownErrorMessage,
  publicFailure,
} from "@repo/backend/confect/failure";
import { TryoutRuntimeError } from "@repo/backend/confect/tryouts/runtime/error";
import { Option, Schema } from "effect";

describe("public domain errors", () => {
  it("preserves error identity without exposing private causes", () => {
    const codec = Schema.Union([
      publicFailure(TryoutRuntimeError),
      AccountUnavailable,
      CheckoutUnavailable,
    ]);
    const failure = new TryoutRuntimeError({
      code: "TRYOUT_RUNTIME_FAILED",
      message: "Unable to complete try-out runtime operation.",
      cause: new Error("Private storage credentials and row identifiers"),
    });
    const encoded = Schema.encodeSync(codec)(failure);
    expect(encoded).toEqual({
      _tag: "TryoutRuntimeError",
      code: failure.code,
      message: failure.message,
    });
    const decoded = Schema.decodeSync(codec)(encoded);
    expect(decoded).toBeInstanceOf(TryoutRuntimeError);
    expect(decoded).not.toHaveProperty("cause");
    for (const error of [
      new AccountUnavailable({ code: "UNAUTHORIZED", message: "Unavailable" }),
      new CheckoutUnavailable({ code: "UNAUTHORIZED", message: "Unavailable" }),
    ]) {
      expect(
        Schema.decodeSync(codec)(Schema.encodeSync(codec)(error))
      ).toBeInstanceOf(error.constructor);
    }
    expect(
      Schema.decodeUnknownOption(codec)({
        _tag: "ForeignError",
        code: "UNAUTHORIZED",
        message: "Unavailable",
      })
    ).toEqual(Option.none());
  });

  it("normalizes unknown SDK failures into internal diagnostic messages", () => {
    expect(getUnknownErrorMessage(new Error("Exploded"))).toBe("Exploded");
    expect(getUnknownErrorMessage("plain failure")).toBe("plain failure");
  });
});
