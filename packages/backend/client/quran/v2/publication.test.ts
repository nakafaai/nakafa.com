import {
  GitCommitShaSchema,
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { QuranPublicationError } from "@repo/backend/client/quran/publication";
import { decodePublishedQuranSourceV2 } from "@repo/backend/client/quran/v2/publication";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";

const source = {
  activeManifestHash: Sha256HashSchema.make(`sha256:${"a".repeat(64)}`),
  activeReleaseId: ReleaseIdSchema.make("quran-release"),
  managed: true,
  snapshotId: Sha256HashSchema.make(`sha256:${"b".repeat(64)}`),
  sourceOrigin: {
    kind: "git" as const,
    sha: GitCommitShaSchema.make("c".repeat(40)),
  },
  sourceRevision: GitCommitShaSchema.make("c".repeat(40)),
};

describe("signed Quran V2 publication source", () => {
  it.live("preserves Git and rollback provenance without invention", () =>
    Effect.gen(function* () {
      const git = yield* decodePublishedQuranSourceV2(source, "attribution");
      const rollback = yield* decodePublishedQuranSourceV2(
        {
          ...source,
          sourceOrigin: {
            kind: "rollback",
            releaseId: ReleaseIdSchema.make("quran-origin-release"),
          },
          sourceRevision: null,
        },
        "attribution"
      );

      expect(git.sourceOrigin).toEqual(source.sourceOrigin);
      expect(rollback).toMatchObject({
        sourceOrigin: {
          kind: "rollback",
          releaseId: "quran-origin-release",
        },
        sourceRevision: null,
      });
    })
  );

  it.live("rejects inactive and contradictory source identities", () =>
    Effect.gen(function* () {
      const inactive = yield* Effect.result(
        decodePublishedQuranSourceV2(
          {
            activeManifestHash: null,
            activeReleaseId: null,
            managed: false,
            snapshotId: null,
            sourceOrigin: null,
            sourceRevision: null,
          },
          "attribution"
        )
      );
      const mismatched = yield* Effect.result(
        decodePublishedQuranSourceV2(
          { ...source, sourceRevision: "d".repeat(40) },
          "attribution"
        )
      );

      for (const result of [inactive, mismatched]) {
        expect(result._tag).toBe("Failure");
        if (result._tag === "Failure") {
          expect(result.failure).toBeInstanceOf(QuranPublicationError);
        }
      }
    })
  );
});
