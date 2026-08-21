import {
  buildRuntimeGenerations,
  formatGenerationEnvironment,
  verifyRuntimeSelection,
  verifyStableRuntimeExport,
} from "@repo/backend/scripts/content-runtime/ci/generation";
import { decodeJsonRows } from "@repo/backend/scripts/content-runtime/ci/json";
import { CONTENT_RUNTIME_CACHE_VERSION } from "@repo/backend/scripts/content-runtime/tables";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";

const ACTIVE_HASH = `sha256:${"a".repeat(64)}`;
const NEXT_HASH = `sha256:${"b".repeat(64)}`;
const contentStateRow = {
  _creationTime: 1,
  _id: "state-1",
  activeManifestHash: ACTIVE_HASH,
  activeReleaseId: "current-release",
  activeSequence: 9,
  articleManifestHash: ACTIVE_HASH,
  articleReleaseId: "current-release",
  articleSequence: 9,
  key: "primary",
  materialManifestHash: ACTIVE_HASH,
  materialReleaseId: "current-release",
  materialSequence: 9,
  nextSequence: 10,
  searchManifestHash: ACTIVE_HASH,
  searchReleaseId: "current-release",
  searchSequence: 9,
  updatedAt: 100,
};
const contentState = [contentStateRow];

describe("content runtime generations", () => {
  it.live(
    "separates portable cache state from the public signed selection",
    () =>
      Effect.gen(function* () {
        const baseline = yield* buildRuntimeGenerations(contentState);
        const systemFieldsChanged = yield* buildRuntimeGenerations([
          { ...contentStateRow, _creationTime: 999, _id: "different" },
        ]);
        expect(systemFieldsChanged).toEqual(baseline);
        expect(baseline.contentStateHash).toBe(
          "21bb4b24ec4dd2151567a1850ab3899b457f01f93f4d9b80f983442a0be6440a"
        );
        expect(baseline.runtimeSelectionHash).toBe(
          "3579932e4fad16d4c08279cb35248e171d5f8b1ce9db4ea4a481acd84112d088"
        );
        expect(formatGenerationEnvironment(baseline)).toBe(
          [
            `AGENT_DOCS_CONTENT_STATE_HASH=${baseline.contentStateHash}`,
            `AGENT_DOCS_RUNTIME_SELECTION_HASH=${baseline.runtimeSelectionHash}`,
          ].join("\n")
        );
      })
  );

  it.live(
    "accepts compaction and inactive-slot drift only for runtime selection",
    () =>
      Effect.gen(function* () {
        const baseline = yield* buildRuntimeGenerations(contentState);
        const operationalDrift = yield* buildRuntimeGenerations([
          {
            ...contentStateRow,
            candidateManifestHash: NEXT_HASH,
            candidateReleaseId: "candidate-release",
            candidateSequence: 10,
            compactCursor: "next-page",
            compactFloor: 9,
            compactFrom: 0,
            compactPhase: "heads",
            compactStartedAt: 200.5,
            compactedFloor: 0,
            nextSequence: 12,
            recoveryManifestHash: `sha256:${"c".repeat(64)}`,
            recoveryReleaseId: "recovery-release",
            recoverySequence: 11,
            updatedAt: 300,
          },
        ]);

        expect(operationalDrift.contentStateHash).not.toBe(
          baseline.contentStateHash
        );
        expect(operationalDrift.runtimeSelectionHash).toBe(
          baseline.runtimeSelectionHash
        );
        expect(
          yield* verifyRuntimeSelection(
            { runtimeSelectionHash: baseline.runtimeSelectionHash },
            operationalDrift
          )
        ).toBeUndefined();
        expect(
          yield* verifyStableRuntimeExport(
            cacheIdentity(baseline.contentStateHash),
            operationalDrift
          ).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "ContentRuntimeCiError",
          message:
            "Production content state changed during signed runtime export.",
        });
      })
  );

  it.live("rejects a coherent change to the public signed selection", () =>
    Effect.gen(function* () {
      const baseline = yield* buildRuntimeGenerations(contentState);
      const changed = yield* buildRuntimeGenerations([
        {
          ...contentStateRow,
          activeManifestHash: NEXT_HASH,
          activeReleaseId: "next-release",
          activeSequence: 10,
          articleManifestHash: NEXT_HASH,
          articleReleaseId: "next-release",
          articleSequence: 10,
          materialManifestHash: NEXT_HASH,
          materialReleaseId: "next-release",
          materialSequence: 10,
          nextSequence: 11,
          searchManifestHash: NEXT_HASH,
          searchReleaseId: "next-release",
          searchSequence: 10,
          updatedAt: 200,
        },
      ]);

      expect(changed.contentStateHash).not.toBe(baseline.contentStateHash);
      expect(changed.runtimeSelectionHash).not.toBe(
        baseline.runtimeSelectionHash
      );
      expect(
        yield* verifyRuntimeSelection(
          { runtimeSelectionHash: baseline.runtimeSelectionHash },
          changed
        ).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "ContentRuntimeCiError",
        message:
          "Production signed content pointer changed during runtime verification.",
      });
    })
  );

  it.live("rejects incomplete slots and unsynchronized read models", () =>
    Effect.gen(function* () {
      const invalidRows = [
        { ...contentStateRow, articleSequence: 8 },
        { ...contentStateRow, candidateReleaseId: "partial-candidate" },
        { ...contentStateRow, compactPhase: "unknown-phase" },
        { ...contentStateRow, recoveryManifestHash: NEXT_HASH },
      ];

      for (const row of invalidRows) {
        expect(
          yield* buildRuntimeGenerations([row]).pipe(Effect.flip)
        ).toMatchObject({ _tag: "ContentRuntimeCiError" });
      }
    })
  );

  it.live("rejects partial or invalid compaction identities", () =>
    Effect.gen(function* () {
      const invalidRows = [
        { ...contentStateRow, compactFloor: 9 },
        { ...contentStateRow, compactCursor: "orphaned-cursor" },
        {
          ...contentStateRow,
          compactCursor: "",
          compactFloor: 9,
          compactFrom: 0,
          compactPhase: "heads",
          compactStartedAt: 200,
        },
        {
          ...contentStateRow,
          compactFloor: 9,
          compactFrom: 1,
          compactPhase: "heads",
          compactStartedAt: 200,
          compactedFloor: 0,
        },
      ];

      for (const row of invalidRows) {
        expect(
          yield* buildRuntimeGenerations([row]).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "ContentRuntimeCiError",
          message:
            "Production contentState has an invalid compaction identity.",
        });
      }
    })
  );

  it.live("rejects incomplete, malformed, excess, or non-singleton rows", () =>
    Effect.gen(function* () {
      expect(yield* decodeJsonRows("")).toEqual([]);
      expect(
        yield* buildRuntimeGenerations([]).pipe(Effect.flip)
      ).toMatchObject({ _tag: "ContentRuntimeCiError" });
      expect(
        yield* buildRuntimeGenerations([...contentState, ...contentState]).pipe(
          Effect.flip
        )
      ).toMatchObject({ _tag: "ContentRuntimeCiError" });
      expect(
        yield* buildRuntimeGenerations([
          { ...contentStateRow, unexpectedField: true },
        ]).pipe(Effect.flip)
      ).toMatchObject({ _tag: "ContentRuntimeCiError" });
      const { articleManifestHash: _missing, ...incomplete } = contentStateRow;
      expect(
        yield* buildRuntimeGenerations([incomplete]).pipe(Effect.flip)
      ).toMatchObject({ _tag: "ContentRuntimeCiError" });
      expect(yield* decodeJsonRows("not-json").pipe(Effect.flip)).toMatchObject(
        { _tag: "ContentRuntimeCiError" }
      );
    })
  );
});

function cacheIdentity(contentStateHash: string) {
  return {
    cacheVersion: CONTENT_RUNTIME_CACHE_VERSION,
    contentStateHash,
    runtimeSchemaFingerprint: "3".repeat(64),
  };
}
