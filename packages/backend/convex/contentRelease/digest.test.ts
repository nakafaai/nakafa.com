import { hashText } from "@repo/backend/convex/contentRelease/digest";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("contentRelease/digest", () => {
  afterEach(() => vi.restoreAllMocks());

  it("hashes exact text and maps Web Crypto failures", async () => {
    await expect(
      Effect.runPromise(hashText("content", "Nakafa"))
    ).resolves.toBe(
      "sha256:f62f8f484c23826f9adf97fd1bef18fad23b3bedada4d908cbcf4c2cf924a63e"
    );

    vi.spyOn(crypto.subtle, "digest").mockRejectedValueOnce(
      new Error("Injected digest failure")
    );
    const failure = await Effect.runPromise(
      hashText("content", "Nakafa").pipe(Effect.flip)
    );
    expect(failure).toMatchObject({
      code: "CONTENT_RELEASE_INTEGRITY",
      message: "Unable to identify content.",
    });
  });
});
