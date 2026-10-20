// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { isInternalContentAuthorized } from "@/lib/content/internal/authorization";

describe("internal content authorization", () => {
  it.effect("accepts only the exact bearer token", () =>
    Effect.gen(function* () {
      expect(
        yield* isInternalContentAuthorized("Bearer secret", "secret")
      ).toBe(true);
      expect(yield* isInternalContentAuthorized("Bearer wrong", "secret")).toBe(
        false
      );
    })
  );

  it.effect("rejects missing, malformed, and empty authorization", () =>
    Effect.gen(function* () {
      expect(yield* isInternalContentAuthorized(null, "secret")).toBe(false);
      expect(yield* isInternalContentAuthorized("Basic secret", "secret")).toBe(
        false
      );
      expect(yield* isInternalContentAuthorized("Bearer ", "secret")).toBe(
        false
      );
    })
  );

  it.effect("is a defect when Web Crypto cannot derive a digest", () =>
    Effect.gen(function* () {
      vi.spyOn(crypto.subtle, "digest").mockRejectedValueOnce(
        new Error("digest unavailable")
      );

      const defect = yield* isInternalContentAuthorized(
        "Bearer secret",
        "secret"
      ).pipe(Effect.catchDefect((cause) => Effect.succeed(cause)));

      expect(defect).toMatchObject({ _tag: "PlatformError" });
    })
  );
});
