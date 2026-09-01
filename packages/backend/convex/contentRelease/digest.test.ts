import { afterEach, describe, expect, it } from "@effect/vitest";
import { hashText } from "@repo/backend/convex/contentRelease/digest";
import { Effect } from "effect";

describe("contentRelease/digest", () => {
  afterEach(() => vi.restoreAllMocks());

  it.live("hashes exact text and maps Web Crypto failures", () =>
    Effect.gen(function* () {
      expect(yield* hashText("content", "Nakafa")).toBe(
        "sha256:f62f8f484c23826f9adf97fd1bef18fad23b3bedada4d908cbcf4c2cf924a63e"
      );

      vi.spyOn(crypto.subtle, "digest").mockRejectedValueOnce(
        new Error("Injected digest failure")
      );
      const failure = yield* hashText("content", "Nakafa").pipe(Effect.flip);
      expect(failure).toMatchObject({
        code: "CONTENT_RELEASE_INTEGRITY",
        message: "Unable to identify content.",
      });
    })
  );
});
