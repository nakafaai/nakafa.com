import { describe, expect, it } from "@effect/vitest";
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
import { Array as Arr, Option, Schema } from "effect";

const ROLLBACK_OF = ReleaseIdSchema.make("release-base");
const ROLLBACK_OF_HASH = Sha256HashSchema.make(`sha256:${"4".repeat(64)}`);
const encoder = new TextEncoder();
const decodeRecord = Schema.decodeUnknownSync(RollbackRecordSchema);

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
});
