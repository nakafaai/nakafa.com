import { assert, describe, it } from "@effect/vitest";
import { TryoutHistoryMigrationSourceSchema } from "@nakafa/aksara-contracts/transport/migration/tryout/response";
import { decodeMigrationSnapshot } from "@repo/backend/convex/tryouts/migration/evidence";
import { Effect, Schema } from "effect";

const digest = (digit: string) => `sha256:${digit.repeat(64)}`;
const snapshot = Schema.decodeSync(
  TryoutHistoryMigrationSourceSchema.fields.evidence.fields.snapshot
)({
  catalogDigest: digest("1"),
  counts: { country: 1, exam: 2, section: 3, set: 4, track: 5 },
  format: "tryout-v1",
  locales: ["en", "id"],
  placementCount: 6,
  placementDigest: digest("2"),
  routeCount: 7,
  snapshotId: digest("3"),
});

describe("tryouts/migration/evidence", () => {
  it.effect(
    "extracts the authenticated manifest from its stored envelope",
    () =>
      Effect.gen(function* () {
        const decoded = yield* decodeMigrationSnapshot(
          JSON.stringify({ family: "tryout", manifest: snapshot })
        );

        assert.deepStrictEqual(decoded, snapshot);
      })
  );

  it.effect("rejects bare, foreign, and extended snapshot envelopes", () =>
    Effect.gen(function* () {
      const invalid = [
        snapshot,
        { family: "page", manifest: snapshot },
        { extra: true, family: "tryout", manifest: snapshot },
      ];

      for (const value of invalid) {
        const error = yield* decodeMigrationSnapshot(
          JSON.stringify(value)
        ).pipe(Effect.flip);

        assert.strictEqual(error.code, "CONTENT_RELEASE_INTEGRITY");
      }
    })
  );
});
