import * as NodeServices from "@effect/platform-node/NodeServices";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  buildRuntimeGenerations,
  formatGenerationEnvironment,
  readProductionGenerations,
  verifyRuntimeSelection,
} from "@repo/backend/scripts/content/runtime/ci/generation";
import { decodeJsonRows } from "@repo/backend/scripts/content/runtime/ci/json";
import { Effect, FileSystem, Redacted } from "effect";

const runDataMock = vi.hoisted(() => vi.fn());

vi.mock("@repo/backend/scripts/content/runtime/ci/command", () => ({
  runConvexData: runDataMock,
}));

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
  articleSlot: "blue",
  key: "primary",
  materialManifestHash: ACTIVE_HASH,
  materialReleaseId: "current-release",
  materialSequence: 9,
  materialSlot: "blue",
  nextSequence: 10,
  searchManifestHash: ACTIVE_HASH,
  searchReleaseId: "current-release",
  searchSequence: 9,
  searchSlot: "blue",
  updatedAt: 100,
};
const contentState = [contentStateRow];

describe("content runtime generations", () => {
  beforeEach(() => {
    runDataMock.mockReset();
  });

  it.live(
    "separates portable cache state from the public signed selection",
    () =>
      Effect.gen(function* () {
        const baseline = yield* buildRuntimeGenerations(contentState);
        const systemFieldsChanged = yield* buildRuntimeGenerations([
          { ...contentStateRow, _creationTime: 999, _id: "different" },
        ]);
        expect(systemFieldsChanged).toEqual(baseline);
        expect(baseline.runtimeSelectionHash).toBe(
          "090771304ab66d29dfd1d9660608ca50541419a77873def422d9a6696c7d8433"
        );
        expect(formatGenerationEnvironment(baseline)).toBe(
          `CONTENT_RUNTIME_SELECTION_HASH=${baseline.runtimeSelectionHash}`
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

        expect(operationalDrift.runtimeSelectionHash).toBe(
          baseline.runtimeSelectionHash
        );
        expect(
          yield* verifyRuntimeSelection(
            { runtimeSelectionHash: baseline.runtimeSelectionHash },
            operationalDrift
          )
        ).toBeUndefined();
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
          articleSlot: "green",
          materialManifestHash: NEXT_HASH,
          materialReleaseId: "next-release",
          materialSequence: 10,
          materialSlot: "green",
          nextSequence: 11,
          searchManifestHash: NEXT_HASH,
          searchReleaseId: "next-release",
          searchSequence: 10,
          searchSlot: "green",
          updatedAt: 200,
        },
      ]);

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
        { ...contentStateRow, compactedFloor: 11 },
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
      const sparse: (typeof contentStateRow)[] = [];
      sparse.length = 1;
      expect(
        yield* buildRuntimeGenerations(sparse).pipe(Effect.flip)
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

  it.live("reads only the production content pointer", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const runnerTemp = yield* fileSystem.makeTempDirectoryScoped({
          directory: "/tmp",
          prefix: "runtime-selection-test-",
        });
        runDataMock.mockImplementationOnce(
          ({ outputPath }: { readonly outputPath: string }) =>
            fileSystem.writeFileString(outputPath, JSON.stringify(contentState))
        );

        expect(
          yield* readProductionGenerations({
            deployKey: Redacted.make("production-key"),
            runnerTemp,
          })
        ).toEqual({
          runtimeSelectionHash:
            "090771304ab66d29dfd1d9660608ca50541419a77873def422d9a6696c7d8433",
        });
        expect(runDataMock).toHaveBeenCalledWith(
          expect.objectContaining({
            deployKey: "production-key",
            limit: 2,
            table: "contentState",
          })
        );
      }).pipe(Effect.provide(NodeServices.layer))
    )
  );
});
