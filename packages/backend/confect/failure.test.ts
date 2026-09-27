import { describe, expect, it } from "@effect/vitest";
import {
  AccountUnavailable,
  accountUnavailableCode,
  accountUnavailableMessage,
} from "@repo/backend/confect/auth/spec";
import {
  failureWire,
  getUnknownErrorMessage,
  readConvexErrorData,
} from "@repo/backend/confect/failure";
import { TryoutRuntimeError } from "@repo/backend/confect/tryouts/runtime/error";
import { ConvexError } from "convex/values";
import { Option, Schema } from "effect";

describe("Convex failure data", () => {
  it("preserves error identity across the wire without exposing private causes", () => {
    const codec = Schema.Union([
      failureWire(TryoutRuntimeError),
      failureWire(AccountUnavailable),
    ]);
    const failure = new TryoutRuntimeError({
      code: "TRYOUT_RUNTIME_FAILED",
      message: "Unable to complete try-out runtime operation.",
      cause: new Error("Private storage credentials and row identifiers"),
    });
    const encoded = Schema.encodeSync(codec)(failure);
    expect(encoded).toEqual({
      code: failure.code,
      message: failure.message,
    });
    const decoded = Schema.decodeSync(codec)(encoded);
    expect(decoded).toBeInstanceOf(TryoutRuntimeError);
    expect(decoded).toMatchObject({ _tag: "TryoutRuntimeError" });
    expect(decoded).not.toHaveProperty("cause");
    expect(
      Schema.decodeSync(codec)({
        code: accountUnavailableCode,
        message: accountUnavailableMessage,
      })
    ).toBeInstanceOf(AccountUnavailable);
    expect(
      Schema.decodeUnknownOption(codec)({
        code: "FOREIGN_CODE",
        message: "Secret",
      })
    ).toEqual(Option.none());
  });
  it("normalizes unknown thrown values into messages", () => {
    expect(getUnknownErrorMessage(new Error("Exploded"))).toBe("Exploded");
    expect(getUnknownErrorMessage("plain failure")).toBe("plain failure");
  });
  it("reads only complete typed Convex error payloads", () => {
    expect(
      readConvexErrorData(
        new AccountUnavailable({
          code: accountUnavailableCode,
          message: accountUnavailableMessage,
        })
      )
    ).toEqual({
      code: accountUnavailableCode,
      message: accountUnavailableMessage,
    });
    expect(
      readConvexErrorData({ code: "untrusted", message: "untagged" })
    ).toBeNull();
    expect(
      readConvexErrorData(
        new ConvexError({
          code: "BOUNDARY_FAILURE",
          message: "Failed",
        })
      )
    ).toEqual({
      code: "BOUNDARY_FAILURE",
      message: "Failed",
    });
    expect(
      readConvexErrorData(
        new ConvexError({
          code: "MISSING",
        })
      )
    ).toBeNull();
    expect(
      readConvexErrorData(
        new ConvexError({
          message: "Missing code",
        })
      )
    ).toBeNull();
    expect(readConvexErrorData(new ConvexError("opaque"))).toBeNull();
    expect(readConvexErrorData(new Error("not Convex"))).toBeNull();
  });
});
