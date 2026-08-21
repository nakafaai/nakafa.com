import { GitCommitShaSchema } from "@nakafa/aksara-contracts/ids";
import { SignedContentReleaseSchema } from "@nakafa/aksara-contracts/release";
import { matchManifest } from "@repo/backend/convex/contentRelease/ingress/current";
import { testSignedRelease } from "@repo/backend/test/content-proof";
import { testReleaseJson } from "@repo/backend/test/content-release";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect, Schema } from "effect";

describe("content publication authenticated reads", () => {
  it.live("accepts an exact manifest and rejects changed signed identity", () =>
    Effect.gen(function* () {
      const unsigned = yield* Schema.decodeUnknownEffect(
        SignedContentReleaseSchema
      )(JSON.parse(testReleaseJson()));
      const first = testSignedRelease(unsigned.manifest);
      const changed = testSignedRelease({
        ...unsigned.manifest,
        origin: { kind: "git", sha: GitCommitShaSchema.make("b".repeat(40)) },
      });

      expect(
        yield* matchManifest(
          first,
          first.manifestHash,
          first.manifest.releaseId
        )
      ).toBeUndefined();
      expect(
        yield* matchManifest(
          changed,
          first.manifestHash,
          first.manifest.releaseId
        ).pipe(Effect.flip)
      ).toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
    })
  );
});
