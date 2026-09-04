import { describe, expect, it } from "@effect/vitest";
import { decodeStoredSnapshotRow } from "@repo/backend/convex/contentRelease/tryout/row";
import { makeTryoutPlacementRow } from "@repo/backend/test/tryout/snapshot";
import { Effect } from "effect";

describe("contentRelease/tryout/row", () => {
  it.effect("accepts the current signed placement contract", () =>
    Effect.gen(function* () {
      const row = makeTryoutPlacementRow("id");

      expect(yield* decodeStoredSnapshotRow(row)).toEqual(row);
    })
  );

  it.effect("rejects predecessor choice rows", () =>
    Effect.gen(function* () {
      const current = makeTryoutPlacementRow("id");
      if (current.record.row.response.kind !== "single-choice") {
        return yield* Effect.fail("Expected a single-choice fixture.");
      }
      const { response, ...identity } = current.record.row;
      const failure = yield* decodeStoredSnapshotRow({
        ...current,
        record: {
          ...current.record,
          row: { ...identity, choices: response.options },
        },
      }).pipe(Effect.flip);

      expect(failure._tag).toBe("SchemaError");
    })
  );
});
