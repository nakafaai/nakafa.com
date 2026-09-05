import { describe, expect, it } from "@effect/vitest";
import { projectActiveRuntime } from "@repo/backend/scripts/content/runtime/ci/projection";
import { makeProgramRuntimeSource } from "@repo/backend/test/program/runtime";
import { makeQuranRuntimeSource } from "@repo/backend/test/quran/runtime";
import { makeTryoutRuntimeSource } from "@repo/backend/test/tryout/serving";
import { Effect } from "effect";

describe("active structured snapshot closure", () => {
  it.effect("rejects sitemap routes whose indexed partition disappeared", () =>
    Effect.gen(function* () {
      const { source } = yield* makeProgramRuntimeSource();
      source.set(
        "curriculumRoutes",
        (source.get("curriculumRoutes") ?? []).map(
          ({ bucket: _, ...row }) => row
        )
      );
      source.set("programBuckets", []);
      expect(
        yield* projectActiveRuntime(source).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "ReleaseError",
        code: "CONTENT_RELEASE_INTEGRITY",
      });
    })
  );

  it.effect(
    "rejects changed program and try-out row indexes against authenticated payloads",
    () =>
      Effect.gen(function* () {
        for (const table of ["programCatalog", "tryoutCatalog"] as const) {
          const { source } = yield* table === "programCatalog"
            ? makeProgramRuntimeSource()
            : makeTryoutRuntimeSource();
          source.set(
            table,
            (source.get(table) ?? []).map((row) => ({
              ...row,
              rowHash: "changed-indexed-hash",
            }))
          );
          expect(
            yield* projectActiveRuntime(source).pipe(Effect.flip)
          ).toMatchObject({
            _tag: "ReleaseError",
            code: "CONTENT_RELEASE_INTEGRITY",
          });
        }
      })
  );

  it.effect(
    "rejects a verified snapshot whose stored envelope names another identity",
    () =>
      Effect.gen(function* () {
        const { source, data } = yield* makeProgramRuntimeSource();
        source.set(
          "contentSnapshots",
          (source.get("contentSnapshots") ?? []).map((row) => ({
            ...row,
            snapshotJson: JSON.stringify({
              ...data.snapshot,
              manifest: {
                ...data.snapshot.manifest,
                snapshotId: `sha256:${"f".repeat(64)}`,
              },
            }),
          }))
        );
        expect(
          yield* projectActiveRuntime(source).pipe(Effect.flip)
        ).toMatchObject({
          message:
            "Signed runtime program snapshot disagrees with its active identity.",
        });
      })
  );

  it.effect(
    "rejects missing bundles and artifacts paired to another placement locale",
    () =>
      Effect.gen(function* () {
        for (const mutation of ["bundle", "locale"] as const) {
          const { source } = yield* makeTryoutRuntimeSource();
          if (mutation === "bundle") {
            source.set("tryoutRuntimeBundles", []);
          } else {
            source.set(
              "tryoutPlacements",
              (source.get("tryoutPlacements") ?? []).map((row) => ({
                ...row,
                questionArtifactLocale: "de",
              }))
            );
          }
          expect(
            yield* projectActiveRuntime(source).pipe(Effect.flip)
          ).toMatchObject({ _tag: "ContentRuntimeCiError" });
        }
      })
  );

  it.effect(
    "retains only the active program snapshot and verifies all signed rows and partitions",
    () =>
      Effect.gen(function* () {
        const { source, data } = yield* makeProgramRuntimeSource();
        source.set("contentSnapshots", [
          ...(source.get("contentSnapshots") ?? []),
          {
            createdAt: 1,
            family: "program",
            retainUntil: 100,
            snapshotId: "inactive",
            snapshotJson: "never decoded",
            cleanupIndex: 3,
            cleanupPart: "curriculum",
          },
        ]);
        source.set("programCatalog", [
          ...(source.get("programCatalog") ?? []),
          {
            displayOrder: 0,
            index: 0,
            programKey: "inactive",
            rowHash: "inactive",
            rowJson: "never decoded",
            snapshotId: "inactive",
          },
        ]);
        const result = yield* projectActiveRuntime(source);
        expect(result.contentSnapshots).toMatchObject([
          { snapshotId: data.snapshotId, snapshotJson: data.manifestJson },
        ]);
        expect(result.programCatalog).toHaveLength(2);
        expect(result.curriculumRoutes).toHaveLength(6);
      })
  );

  it.effect(
    "rejects incomplete program rows, duplicate indexes, and lost snapshot manifests",
    () =>
      Effect.gen(function* () {
        for (const mutation of [
          "missing-row",
          "duplicate-index",
          "missing-manifest",
        ] as const) {
          const { source } = yield* makeProgramRuntimeSource();
          if (mutation === "missing-manifest") {
            source.set("contentSnapshots", []);
          } else if (mutation === "missing-row") {
            source.set(
              "programCatalog",
              (source.get("programCatalog") ?? []).slice(1)
            );
          } else {
            source.set(
              "programCatalog",
              (source.get("programCatalog") ?? []).map((row) => ({
                ...row,
                index: 0,
              }))
            );
          }
          expect(
            yield* projectActiveRuntime(source).pipe(Effect.flip)
          ).toMatchObject({ _tag: "ContentRuntimeCiError" });
        }
      })
  );

  it.effect(
    "rejects signed snapshot body corruption without dropping the affected row",
    () =>
      Effect.gen(function* () {
        const { source } = yield* makeProgramRuntimeSource();
        source.set(
          "programCatalog",
          (source.get("programCatalog") ?? []).map((row) => ({
            ...row,
            rowJson: "{}",
          }))
        );
        expect(
          yield* projectActiveRuntime(source).pipe(Effect.flip)
        ).toMatchObject({
          message:
            "Signed runtime snapshot rows do not match their authenticated manifests.",
        });
      })
  );

  it.effect(
    "keeps the inherited try-out bundle and its artifact closure without retaining its source release",
    () =>
      Effect.gen(function* () {
        const { source, bundle } = yield* makeTryoutRuntimeSource();
        const result = yield* projectActiveRuntime(source);
        expect(result.contentReleases.map((row) => row.releaseId)).toEqual([
          "tryout-active",
        ]);
        expect(result.tryoutRuntimeBundles).toMatchObject([
          {
            bundleJson: JSON.stringify(bundle),
            sourceReleaseId: "tryout-origin",
          },
        ]);
        expect(result.contentArtifacts).toHaveLength(6);
        expect(result.contentHeads).toEqual([]);
        expect(result.tryoutPlacements).toHaveLength(3);
      })
  );

  it.effect(
    "rejects missing try-out artifacts or a bundle paired to another renderer",
    () =>
      Effect.gen(function* () {
        for (const mutation of ["artifact", "renderer"] as const) {
          const { source } = yield* makeTryoutRuntimeSource();
          if (mutation === "artifact") {
            source.set(
              "contentArtifacts",
              (source.get("contentArtifacts") ?? []).slice(1)
            );
          } else {
            source.set(
              "tryoutRuntimeBundles",
              (source.get("tryoutRuntimeBundles") ?? []).map((row) => ({
                ...row,
                rendererManifestHash: "mismatched",
              }))
            );
          }
          expect(
            yield* projectActiveRuntime(source).pipe(Effect.flip)
          ).toMatchObject({ _tag: "ContentRuntimeCiError" });
        }
      })
  );
});

describe("active Quran snapshot closure", () => {
  it.effect(
    "authenticates the complete active Quran while excluding inactive snapshots and search",
    () =>
      Effect.gen(function* () {
        const { source, manifest } = yield* makeQuranRuntimeSource();
        for (const table of ["quranRows", "quranSearch"] as const) {
          const rows = source.get(table) ?? [];
          source.set(table, [
            ...rows,
            ...rows.map((row) => ({ ...row, snapshotId: "inactive" })),
          ]);
        }
        const projected = yield* projectActiveRuntime(source);
        expect(projected.quranRows).toHaveLength(manifest.projectionCount);
        expect(projected.quranSearch).toHaveLength(manifest.searchCount);
        expect(
          projected.quranRows.every(
            (row) => row.snapshotId === manifest.snapshotId
          )
        ).toBe(true);
      })
  );

  it.effect.each(["missing", "duplicate", "changed", "orphaned"] as const)(
    "rejects %s Quran search projections",
    (mutation) =>
      Effect.gen(function* () {
        const fixture = yield* makeQuranRuntimeSource();
        const rows = fixture.source.get("quranSearch") ?? [];
        const changes = {
          missing: rows.slice(1),
          duplicate: [...rows, ...rows.slice(0, 1)],
          changed: rows.map((row) => ({
            ...row,
            text: "changed after verification",
          })),
          orphaned: [
            ...rows,
            ...rows.slice(0, 1).map((row) => ({ ...row, index: 0 })),
          ],
        };
        fixture.source.set("quranSearch", changes[mutation]);
        expect(
          yield* projectActiveRuntime(fixture.source).pipe(Effect.flip)
        ).toMatchObject({ _tag: "ContentRuntimeCiError" });
      })
  );
});
