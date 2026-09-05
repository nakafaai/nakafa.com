import { describe, expect, it } from "@effect/vitest";
import {
  type TryoutCatalogRow,
  TryoutCatalogRowSchema,
  TryoutTrackSchema,
} from "@nakafa/aksara-contracts/tryout/catalog";
import {
  loadTryoutSnapshotCatalog,
  readTryoutCatalog,
} from "@repo/backend/content/tryout/catalog";
import { convexTryoutLayer } from "@repo/backend/content/tryout/convex";
import { decodeSnapshotRowJson } from "@repo/backend/convex/contentRelease/parse";
import { TRYOUT_CATALOG_LIMIT } from "@repo/backend/convex/contentRelease/tryout/limits";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  activateTryoutSnapshot,
  makeTryoutCatalogRow,
  makeTryoutPlacementRow,
} from "@repo/backend/test/tryout/snapshot";
import { makeTryoutStartHierarchy } from "@repo/backend/test/tryout/source";
import { convexTest } from "convex-test";
import { Effect, Schema } from "effect";

/** Creates one technical track used to break localized count symmetry. */
function makeTechnicalTrack() {
  return Schema.decodeSync(TryoutTrackSchema)({
    countryKey: "indonesia",
    description: "Technical track",
    examKey: "snbt",
    graph: {
      alignmentId: "alignment:tryout:technical:track",
      assetId: "asset:en:tryout:technical:track",
      conceptId: "concept:tryout:technical:track",
      learningObjectId: "lo:tryout-technical-track",
      lensId: "lens:tryout:technical",
    },
    kind: "track",
    appLocale: "en",
    order: 1,
    publicPath: "try-out/indonesia/snbt/2027",
    questionCount: 1,
    sectionCount: 1,
    setCount: 1,
    sourceRevision: "technical-revision",
    title: "Technical track",
    trackKey: "2027",
    trackKind: "year",
    visibleSectionCount: 1,
  });
}

/** Activates the smallest coherent two-locale catalog. */
async function activateCatalog() {
  const t = convexTest(schema, convexModules);
  const catalog = [
    makeTryoutCatalogRow("en").record.row,
    makeTryoutCatalogRow("id").record.row,
  ];
  const placements = [
    makeTryoutPlacementRow("en").record.row,
    makeTryoutPlacementRow("id").record.row,
  ];
  const snapshotId = await t.mutation((ctx) =>
    activateTryoutSnapshot(ctx, { catalog, placements })
  );
  return { snapshotId, t };
}

describe("contentRelease/tryout/catalog", () => {
  it.effect(
    "reads a retained catalog by its immutable snapshot without an active release pin",
    () =>
      Effect.gen(function* () {
        const { snapshotId, t } = yield* Effect.promise(activateCatalog);
        const retained = yield* Effect.promise(() =>
          t.query((ctx) =>
            runConvexProgram(
              loadTryoutSnapshotCatalog("id", snapshotId).pipe(
                Effect.provide(convexTryoutLayer(ctx))
              )
            )
          )
        );
        expect(retained).toMatchObject({
          activeManifestHash: null,
          activeReleaseId: null,
          bundleHash: null,
          snapshotId,
          sourceRevision: null,
        });
        expect(retained.entries).toHaveLength(1);
      })
  );

  it.effect(
    "enforces the signed catalog read budget before loading a large hierarchy",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const country = makeTryoutCatalogRow("id").record.row;
        const catalog = Array.from(
          { length: TRYOUT_CATALOG_LIMIT + 1 },
          (_, index) =>
            Schema.decodeSync(TryoutCatalogRowSchema)({
              ...country,
              countryKey: `country-${index}`,
              order: index + 1,
              publicPath: `try-out/country-${index}`,
            })
        );
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            activateTryoutSnapshot(ctx, {
              catalog,
              placements: [makeTryoutPlacementRow("id").record.row],
            })
          )
        );
        yield* Effect.promise(() =>
          expect(
            t.query((ctx) =>
              runConvexProgram(
                readTryoutCatalog("id").pipe(
                  Effect.provide(convexTryoutLayer(ctx))
                )
              )
            )
          ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_LIMIT" } })
        );
      })
  );

  it.effect(
    "rejects per-locale kind counts that disagree with the signed global inventory",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const country = makeTryoutCatalogRow("en").record.row;
        const track = makeTechnicalTrack();
        const catalog = yield* Schema.decodeUnknownEffect(
          Schema.Array(TryoutCatalogRowSchema)
        )([
          country,
          {
            ...country,
            countryKey: "germany",
            publicPath: "try-out/germany",
          },
          ...[2027, 2028].map((year) => ({
            ...track,
            appLocale: "id",
            graph: {
              ...track.graph,
              assetId: `asset:id:tryout:technical:track:${year}`,
            },
            publicPath: `try-out/indonesia/snbt/${year}`,
            trackKey: String(year),
          })),
        ]).pipe(Effect.orDie);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            activateTryoutSnapshot(ctx, {
              catalog,
              placements: [
                makeTryoutPlacementRow("en").record.row,
                makeTryoutPlacementRow("id").record.row,
              ],
            })
          )
        );
        yield* Effect.promise(() =>
          expect(
            t.query((ctx) =>
              runConvexProgram(
                readTryoutCatalog("en").pipe(
                  Effect.provide(convexTryoutLayer(ctx))
                )
              )
            )
          ).rejects.toMatchObject({
            data: {
              code: "CONTENT_RELEASE_INTEGRITY",
              message: expect.stringContaining("hierarchy counts"),
            },
          })
        );
      })
  );

  it.effect(
    "rejects unequal public-route inventory even when every localized kind count agrees",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const catalog: TryoutCatalogRow[] = [];
        for (const locale of ["en", "id"] as const) {
          catalog.push(makeTryoutCatalogRow(locale).record.row);
          const section = makeTryoutStartHierarchy(
            locale,
            locale === "en" ? "visible" : "internal-entry"
          ).find((row) => row.kind === "section");
          if (section === undefined) {
            return yield* Effect.die("Expected a technical section.");
          }
          for (const index of [1, 2]) {
            catalog.push(
              yield* Schema.decodeEffect(TryoutCatalogRowSchema)({
                ...section,
                sectionKey: `section-${index}`,
                publicPath:
                  locale === "en"
                    ? `${section.publicPath}-${index}`
                    : undefined,
              }).pipe(Effect.orDie)
            );
          }
        }
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            activateTryoutSnapshot(ctx, {
              catalog,
              placements: [
                makeTryoutPlacementRow("en").record.row,
                makeTryoutPlacementRow("id").record.row,
              ],
            })
          )
        );
        yield* Effect.promise(() =>
          expect(
            t.query((ctx) =>
              runConvexProgram(
                readTryoutCatalog("en").pipe(
                  Effect.provide(convexTryoutLayer(ctx))
                )
              )
            )
          ).rejects.toMatchObject({
            data: {
              code: "CONTENT_RELEASE_INTEGRITY",
              message: expect.stringContaining("public route count"),
            },
          })
        );
      })
  );

  it("requires an active signed try-out publication", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readTryoutCatalog("en").pipe(Effect.provide(convexTryoutLayer(ctx)))
        )
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_MISSING" } });
  });

  it.live(
    "returns one verified localized hierarchy from the active snapshot",
    () =>
      Effect.gen(function* () {
        const { snapshotId, t } = yield* Effect.promise(() =>
          activateCatalog()
        );
        const result = yield* Effect.promise(() =>
          t.query((ctx) =>
            runConvexProgram(
              readTryoutCatalog("id").pipe(
                Effect.provide(convexTryoutLayer(ctx))
              )
            )
          )
        );
        const rows = yield* Effect.forEach(
          result.rowJson,
          decodeSnapshotRowJson
        );

        expect(result).toMatchObject({ snapshotId });
        expect(rows).toMatchObject([
          {
            family: "tryout",
            record: { row: { appLocale: "id", kind: "country" } },
            rowKind: "catalog",
          },
        ]);
      })
  );

  it("requires active signed question ownership", async () => {
    const { t } = await activateCatalog();
    await t.mutation(async (ctx) => {
      const release = await ctx.db.query("contentReleases").unique();
      if (!release) {
        throw new Error("Expected one technical release.");
      }
      await ctx.db.patch("contentReleases", release._id, {
        resultFamilies: ["material"],
      });
    });

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readTryoutCatalog("en").pipe(Effect.provide(convexTryoutLayer(ctx)))
        )
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });

  it("rejects asymmetric localized hierarchy counts", async () => {
    const asymmetric = convexTest(schema, convexModules);
    await asymmetric.mutation((ctx) =>
      activateTryoutSnapshot(ctx, {
        catalog: [
          makeTryoutCatalogRow("en").record.row,
          makeTryoutCatalogRow("id").record.row,
          makeTechnicalTrack(),
        ],
        placements: [
          makeTryoutPlacementRow("en").record.row,
          makeTryoutPlacementRow("id").record.row,
        ],
      })
    );
    await expect(
      asymmetric.query((ctx) =>
        runConvexProgram(
          readTryoutCatalog("en").pipe(Effect.provide(convexTryoutLayer(ctx)))
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("fails closed when one signed row disappears or changes indexed facts", async () => {
    const missing = await activateCatalog();
    await missing.t.mutation(async (ctx) => {
      const row = await ctx.db
        .query("tryoutCatalog")
        .withIndex("by_snapshotId_and_appLocale_and_publicPath", (index) =>
          index.eq("snapshotId", missing.snapshotId).eq("appLocale", "en")
        )
        .unique();
      if (!row) {
        throw new Error("Expected one English catalog row.");
      }
      await ctx.db.delete(row._id);
    });
    await expect(
      missing.t.query((ctx) =>
        runConvexProgram(
          readTryoutCatalog("en").pipe(Effect.provide(convexTryoutLayer(ctx)))
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const changed = await activateCatalog();
    await changed.t.mutation(async (ctx) => {
      const row = await ctx.db
        .query("tryoutCatalog")
        .withIndex("by_snapshotId_and_appLocale_and_publicPath", (index) =>
          index.eq("snapshotId", changed.snapshotId).eq("appLocale", "en")
        )
        .unique();
      if (!row) {
        throw new Error("Expected one English catalog row.");
      }
      await ctx.db.patch("tryoutCatalog", row._id, { order: 10 });
    });
    await expect(
      changed.t.query((ctx) =>
        runConvexProgram(
          readTryoutCatalog("en").pipe(Effect.provide(convexTryoutLayer(ctx)))
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});
