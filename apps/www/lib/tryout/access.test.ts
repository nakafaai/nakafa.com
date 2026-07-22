import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import {
  getTryoutStartDialogKind,
  isTryoutAccessRequired,
  TryoutClientRequestError,
  toTryoutClientRequestError,
} from "@/lib/tryout/access";

describe("tryout access", () => {
  it("uses the advisory state until the mutation requires an upgrade", () => {
    expect(getTryoutStartDialogKind({ kind: "included" }, false)).toBe(
      "included"
    );
    expect(getTryoutStartDialogKind(undefined, false)).toBe("free-attempt");
    expect(getTryoutStartDialogKind({ kind: "free-attempt" }, true)).toBe(
      "upgrade-required"
    );
  });

  it("recognizes only the structured access-required Convex error", () => {
    const networkError = new Error("Network error");

    expect(toTryoutClientRequestError(networkError).cause).toBe(networkError);
    expect(
      isTryoutAccessRequired(
        new TryoutClientRequestError({
          cause: new ConvexError({
            code: "TRYOUT_ACCESS_REQUIRED",
            message: "Upgrade required.",
          }),
        })
      )
    ).toBe(true);
    expect(
      isTryoutAccessRequired(
        new TryoutClientRequestError({ cause: networkError })
      )
    ).toBe(false);
    expect(
      isTryoutAccessRequired(
        new TryoutClientRequestError({ cause: new ConvexError("plain") })
      )
    ).toBe(false);
    expect(
      isTryoutAccessRequired(
        new TryoutClientRequestError({ cause: new ConvexError(null) })
      )
    ).toBe(false);
    expect(
      isTryoutAccessRequired(
        new TryoutClientRequestError({ cause: new ConvexError({}) })
      )
    ).toBe(false);
    expect(
      isTryoutAccessRequired(
        new TryoutClientRequestError({
          cause: new ConvexError({ code: "TRYOUT_OTHER" }),
        })
      )
    ).toBe(false);
  });
});
