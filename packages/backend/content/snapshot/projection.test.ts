import { describe, expect, it } from "@effect/vitest";
import { projectActiveRuntime } from "@repo/backend/content/snapshot/projection";
import {
  makePageRuntimeSource,
  makeRuntimeSource,
} from "@repo/backend/test/content/snapshot";
import { Effect } from "effect";

describe("active static runtime projection", () => {
  it.effect(
    "retains inherited serving bytes while removing history, candidate state and compaction cursors",
    () =>
      Effect.gen(function* () {
        const { source, state, head, binding, artifact } =
          makePageRuntimeSource();
        source.set("contentState", [
          {
            ...state,
            candidateManifestHash: state.activeManifestHash,
            candidateReleaseId: "candidate",
            candidateSequence: 10,
            recoveryManifestHash: state.activeManifestHash,
            recoveryReleaseId: "recovery",
            recoverySequence: 8,
            compactFloor: 7,
            compactFrom: 0,
            compactPhase: "heads",
            compactStartedAt: 90,
            compactCursor: "production-cursor",
          },
        ]);
        source.set("contentHeads", [
          { ...head, sequence: 5, releaseId: "obsolete" },
          head,
          {
            ...head,
            sequence: 10,
            releaseId: "candidate",
            operation: "delete",
          },
        ]);
        source.set("contentBindings", [
          { ...binding, sequence: 5, releaseId: "obsolete" },
          binding,
          {
            ...binding,
            sequence: 10,
            releaseId: "candidate",
            operation: "delete",
          },
        ]);
        const activeRelease = source.get("contentReleases")?.[0];
        expect(activeRelease).toBeDefined();
        source.set("contentReleases", [
          ...(source.get("contentReleases") ?? []),
          { ...activeRelease, releaseId: "obsolete" },
        ]);
        source.set("contentArtifacts", [
          ...(source.get("contentArtifacts") ?? []),
          {
            artifactHash: "orphan",
            artifactJson: "not read",
            createdAt: 1,
            retainUntil: 1,
          },
        ]);
        const result = yield* projectActiveRuntime(source);
        expect(result.contentState).toEqual([state]);
        expect(result.contentReleases).toHaveLength(1);
        expect(result.contentHeads).toEqual([head]);
        expect(result.contentBindings).toEqual([binding]);
        expect(result.contentArtifacts).toMatchObject([
          {
            artifactHash: artifact.artifactHash,
            artifactJson: JSON.stringify(artifact),
          },
        ]);
        expect(result.contentKeys).toHaveLength(1);
      })
  );

  it.effect(
    "removes both tombstones and their superseded rows without resurrecting routes",
    () =>
      Effect.gen(function* () {
        const { source, head, binding } = makePageRuntimeSource();
        source.set("contentHeads", [
          head,
          { ...head, sequence: 8, operation: "delete" },
        ]);
        source.set("contentBindings", [
          binding,
          { ...binding, sequence: 8, operation: "delete" },
        ]);
        const result = yield* projectActiveRuntime(source);
        expect(result.contentHeads).toEqual([]);
        expect(result.contentBindings).toEqual([]);
        expect(result.contentArtifacts).toEqual([]);
        expect(result.contentKeys).toEqual([]);
      })
  );

  it.effect(
    "rejects duplicate latest versions even when their insertion order differs",
    () =>
      Effect.gen(function* () {
        const { source, head } = makePageRuntimeSource();
        source.set("contentHeads", [
          head,
          { ...head, sequence: 5 },
          { ...head, index: 8 },
        ]);
        expect(
          yield* projectActiveRuntime(source).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "ContentSnapshotError",
          message: "Signed runtime has duplicate current MVCC identities.",
        });
      })
  );

  it.effect(
    "allows duplicate obsolete versions once one unique newer version supersedes them",
    () =>
      Effect.gen(function* () {
        const { source, head } = makePageRuntimeSource();
        source.set("contentHeads", [
          { ...head, sequence: 5 },
          { ...head, sequence: 5 },
          head,
        ]);
        expect((yield* projectActiveRuntime(source)).contentHeads).toEqual([
          head,
        ]);
      })
  );

  it.effect(
    "rejects a missing artifact or a deleted binding for a still-public head",
    () =>
      Effect.gen(function* () {
        for (const missing of ["artifact", "binding"] as const) {
          const { source, binding } = makePageRuntimeSource();
          if (missing === "artifact") {
            source.set("contentArtifacts", []);
          } else {
            source.set("contentBindings", [
              binding,
              { ...binding, sequence: 8, operation: "delete" },
            ]);
          }
          expect(
            yield* projectActiveRuntime(source).pipe(Effect.flip)
          ).toMatchObject({ _tag: "ContentSnapshotError" });
        }
      })
  );

  it.effect(
    "fails closed on missing source tables and malformed database rows",
    () =>
      Effect.gen(function* () {
        const { source } = makeRuntimeSource();
        source.delete("quranRows");
        expect(
          yield* projectActiveRuntime(source).pipe(Effect.flip)
        ).toMatchObject({
          message: "Signed runtime source is missing quranRows.",
        });
        source.set("quranRows", [{ invalid: true }]);
        expect(
          yield* projectActiveRuntime(source).pipe(Effect.flip)
        ).toMatchObject({
          message:
            "Signed runtime source quranRows violates its database contract.",
        });
      })
  );

  it.effect("rejects missing or duplicate active release records", () =>
    Effect.gen(function* () {
      const fixture = makeRuntimeSource();
      const releases = fixture.source.get("contentReleases") ?? [];
      for (const rows of [[], [...releases, ...releases]]) {
        const source = new Map(fixture.source);
        source.set("contentReleases", rows);
        expect(
          yield* projectActiveRuntime(source).pipe(Effect.flip)
        ).toMatchObject({
          message: "Signed runtime must contain exactly one active release.",
        });
      }
    })
  );

  it.effect(
    "rejects missing head identities, changed projections, and missing public page keys",
    () =>
      Effect.gen(function* () {
        for (const mutation of [
          "artifact-hash",
          "projection-hash",
          "page-key",
        ] as const) {
          const { source, head } = makePageRuntimeSource();
          if (mutation === "page-key") {
            source.set("contentKeys", []);
          } else if (mutation === "artifact-hash") {
            const { artifactHash: _, ...withoutArtifact } = head;
            source.set("contentHeads", [withoutArtifact]);
          } else {
            source.set("contentHeads", [
              { ...head, projectionHash: "changed" },
            ]);
          }
          expect(
            yield* projectActiveRuntime(source).pipe(Effect.flip)
          ).toMatchObject({ _tag: "ContentSnapshotError" });
        }
      })
  );

  it.effect(
    "rejects an active release whose sequence disagrees with the copied pointer",
    () =>
      Effect.gen(function* () {
        const { source } = makeRuntimeSource();
        source.set(
          "contentReleases",
          (source.get("contentReleases") ?? []).map((row) => ({
            ...row,
            sequence: 8,
          }))
        );
        expect(
          yield* projectActiveRuntime(source).pipe(Effect.flip)
        ).toMatchObject({
          message:
            "Signed runtime active release disagrees with its serving pointer.",
        });
      })
  );
});
