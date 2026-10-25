import { describe, expect, it } from "@effect/vitest";
import {
  canonicalizeSignedContentArtifact,
  SignedContentArtifactSchema,
} from "@nakafa/aksara-contracts/content";
import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  canonicalizeRollbackPage,
  canonicalizeRollbackRecord,
  type RollbackPage,
  type RollbackRecord,
  RollbackRecordSchema,
} from "@nakafa/aksara-contracts/release/rollback/spec";
import {
  rollbackPageBytes,
  serializeRollbackPage,
} from "@repo/backend/confect/contentRelease/rollback/page";
import { convexModules } from "@repo/backend/confect/test.setup";
import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import {
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
} from "@repo/backend/test/content/release";
import {
  activateRollbackFixture,
  expectedRollbackPage,
  insertRollbackItem,
  propsDenseArtifactJson,
} from "@repo/backend/test/content/rollback";
import { convexTest } from "convex-test";
import { Array as Arr, Option, Schema } from "effect";

const ROLLBACK_OF = ReleaseIdSchema.make("release-base");
const ROLLBACK_OF_HASH = Sha256HashSchema.make(`sha256:${"4".repeat(64)}`);
const encoder = new TextEncoder();
const decodeRecord = Schema.decodeUnknownSync(RollbackRecordSchema);
const SignedArtifactJsonSchema = Schema.fromJsonString(
  SignedContentArtifactSchema
);
const prepareRollback = internal.contentRelease.rollback.prepareRollback;

/** Builds one exact delete transition, the smallest record the contract accepts. */
function deleteRecord(index: number) {
  const change = {
    artifactLocale: "en",
    contentKey: `test:head-${index}`,
    family: "material",
    operation: "delete",
  };
  return decodeRecord({ current: { change }, index, prior: { change } });
}

/** Builds one page whose cursor and completion follow its last record. */
function pageOf(
  records: readonly RollbackRecord[],
  total: number
): RollbackPage {
  const nextIndex = Option.match(Arr.last(records), {
    onNone: () => -1,
    onSome: (record) => record.index,
  });
  return {
    done: nextIndex === total - 1,
    nextIndex,
    records,
    rollbackOf: ROLLBACK_OF,
    rollbackOfManifestHash: ROLLBACK_OF_HASH,
    total,
  };
}

describe("contentRelease/rollback/page", () => {
  it.each([0, 1, 3])(
    "serializes a page of %i records exactly as the contract does",
    (count) => {
      const records = Array.from({ length: count }, (_, index) =>
        deleteRecord(index)
      );
      const texts = Arr.map(records, canonicalizeRollbackRecord);
      const recordBytes = Arr.reduce(
        texts,
        0,
        (bytes, text) => bytes + encoder.encode(text).byteLength
      );

      for (const total of [count, count + 1]) {
        const page = pageOf(records, total);
        expect(serializeRollbackPage(page, texts)).toBe(
          canonicalizeRollbackPage(page)
        );
        expect(rollbackPageBytes(page, recordBytes)).toBe(
          encoder.encode(canonicalizeRollbackPage(page)).byteLength
        );
      }
    }
  );

  it("emits each stored artifact's bytes instead of encoding its signed tree again", async () => {
    const t = convexTest(schema, convexModules);
    const stored = propsDenseArtifactJson(0);
    await t.mutation(async (ctx) => {
      await activateRollbackFixture(ctx, 1);
      await insertRollbackItem(ctx, 0, false, "Technical fixture", {
        currentArtifactJson: stored,
      });
    });

    const source = await t.query(prepareRollback, {
      afterIndex: -1,
      limit: 1,
      rollbackOf: TEST_RELEASE_ID,
      rollbackOfManifestHash: TEST_MANIFEST_HASH,
    });
    expect(source).toContain(stored);
  });

  it("writes props-dense records at the tree ceiling exactly as the canonical walk", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await activateRollbackFixture(ctx, 2);
      for (const index of [0, 1]) {
        await insertRollbackItem(ctx, index, true, "Technical fixture", {
          currentArtifactJson: canonicalizeSignedContentArtifact(
            Schema.decodeSync(SignedArtifactJsonSchema)(
              propsDenseArtifactJson(index)
            )
          ),
        });
      }
    });

    const actual = await t.query(prepareRollback, {
      afterIndex: -1,
      limit: 2,
      rollbackOf: TEST_RELEASE_ID,
      rollbackOfManifestHash: TEST_MANIFEST_HASH,
    });
    expect(actual).toBe(await expectedRollbackPage(t, -1, 2, 2));
  });
});
