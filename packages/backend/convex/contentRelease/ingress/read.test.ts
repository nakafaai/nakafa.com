import { GitCommitShaSchema } from "@nakafa/aksara-contracts/ids";
import { SignedContentReleaseSchema } from "@nakafa/aksara-contracts/release";
import { matchManifest } from "@repo/backend/convex/contentRelease/ingress/current";
import { testSignedRelease } from "@repo/backend/test/content-proof";
import { testReleaseJson } from "@repo/backend/test/content-release";
import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("content publication authenticated reads", () => {
  it("accepts an exact manifest and rejects changed signed identity", async () => {
    const unsigned = Schema.decodeUnknownSync(SignedContentReleaseSchema)(
      JSON.parse(testReleaseJson())
    );
    const first = testSignedRelease(unsigned.manifest);
    const changed = testSignedRelease({
      ...unsigned.manifest,
      origin: { kind: "git", sha: GitCommitShaSchema.make("b".repeat(40)) },
    });

    await expect(
      Effect.runPromise(
        matchManifest(first, first.manifestHash, first.manifest.releaseId)
      )
    ).resolves.toBeUndefined();
    await expect(
      Effect.runPromise(
        matchManifest(
          changed,
          first.manifestHash,
          first.manifest.releaseId
        ).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
  });
});
