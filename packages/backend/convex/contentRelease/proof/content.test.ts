// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  ContentKeySchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { ArtifactLocaleSchema } from "@nakafa/aksara-contracts/locale";
import {
  ContentReleaseItemSchema,
  ContentReleaseManifestSchema,
} from "@nakafa/aksara-contracts/release";
import { digestItems } from "@nakafa/aksara-contracts/release/digest";
import { digestRollbackSnapshot } from "@nakafa/aksara-contracts/release/rollback/digest";
import {
  canonicalizeRollbackSnapshotEntry,
  RollbackSnapshotEntrySchema,
} from "@nakafa/aksara-contracts/release/rollback/spec";
import { verifyContentStreams } from "@repo/backend/convex/contentRelease/proof/content";
import {
  testEmptyManifest,
  testSignedRelease,
} from "@repo/backend/test/content/proof";
import { Effect, Stream } from "effect";

const releaseId = ReleaseIdSchema.make("release-one-pass-proof");

describe("content proof streams", () => {
  it.live("verifies three digests while visiting each stored row once", () =>
    Effect.gen(function* () {
      const items = Array.from({ length: 3 }, (_, index) =>
        ContentReleaseItemSchema.make({
          change: {
            contentKey: ContentKeySchema.make(`test:one-pass-${index}`),
            family: "material",
            artifactLocale: ArtifactLocaleSchema.make("en"),
            operation: "delete",
          },
          index,
          releaseId,
        })
      );
      const rollbacks = items.map((item) =>
        RollbackSnapshotEntrySchema.make({
          index: item.index,
          releaseId,
          snapshot: {
            contentKey: item.change.contentKey,
            family: item.change.family,
            artifactLocale: item.change.artifactLocale,
            state: "absent",
          },
        })
      );
      const itemDigest = yield* digestItems(
        releaseId,
        Stream.fromIterable(items)
      );
      const rollbackDigest = yield* digestRollbackSnapshot(
        releaseId,
        Stream.fromIterable(rollbacks)
      );
      const release = testSignedRelease(
        ContentReleaseManifestSchema.make({
          ...testEmptyManifest(releaseId),
          deleteCount: items.length,
          itemCount: items.length,
          itemsDigest: itemDigest.digest,
          rollbackCount: rollbacks.length,
          rollbackDigest: rollbackDigest.digest,
        })
      );
      const rows = items.map((item, index) => {
        const rollback = rollbacks[index];
        if (!rollback) {
          throw new Error(`Expected rollback row ${index}.`);
        }
        return {
          index: item.index,
          itemJson: JSON.stringify(item),
          rollbackJson: canonicalizeRollbackSnapshotEntry(rollback),
        };
      });
      let visits = 0;
      const result = yield* verifyContentStreams(
        release,
        Stream.fromIterable(rows).pipe(
          Stream.tap(() =>
            Effect.sync(() => {
              visits += 1;
            })
          )
        )
      );

      expect(result).toMatchObject({
        items: { deleteCount: items.length, upsertCount: 0 },
        projections: { count: 0 },
        rollback: { count: rollbacks.length },
      });
      expect(visits).toBe(items.length);
    })
  );
});
