import { describe, expect, it } from "@effect/vitest";
import {
  ACTIVE_APP_LOCALES,
  ActiveAppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import {
  type TryoutCatalogRow,
  TryoutCatalogRowSchema,
} from "@nakafa/aksara-contracts/tryout/catalog";
import { TryoutPlacementSchema } from "@nakafa/aksara-contracts/tryout/placement";
import { snapshotPublicationLayer } from "@repo/backend/content/publication/snapshot";
import { readTryoutCatalog } from "@repo/backend/content/tryout/catalog";
import { convexTryoutLayer } from "@repo/backend/content/tryout/convex";
import { readTryoutMetadata } from "@repo/backend/content/tryout/metadata";
import {
  readTryoutSectionPage,
  readTryoutSetPage,
} from "@repo/backend/content/tryout/page";
import { readProtectedProgram } from "@repo/backend/content/tryout/protected";
import { readTryoutReference } from "@repo/backend/content/tryout/reference";
import { readTryoutSet } from "@repo/backend/content/tryout/set";
import { snapshotTryoutLayer } from "@repo/backend/content/tryout/snapshot";
import { TryoutSource } from "@repo/backend/content/tryout/source";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { testTextHash } from "@repo/backend/test/content/release";
import { insertTestTryoutRuntimeBundle } from "@repo/backend/test/runtime/bundle";
import { insertProtectedRuntime } from "@repo/backend/test/runtime/protected";
import { activateTryoutSnapshot } from "@repo/backend/test/tryout/snapshot";
import {
  activateTryoutStartSource,
  makeTryoutStartHierarchy,
  makeTryoutStartPlacement,
} from "@repo/backend/test/tryout/source";
import { convexTest } from "convex-test";
import { Effect, Layer, Schema, Struct } from "effect";

/** Copies the same immutable fixture rows consumed by the native reader. */
async function tryoutSnapshot(ctx: QueryCtx) {
  return {
    contentKeys: (await ctx.db.query("contentKeys").collect()).map((row) =>
      Struct.omit(row, ["_id", "_creationTime"])
    ),
    contentState: (await ctx.db.query("contentState").collect()).map((row) =>
      Struct.omit(row, ["_id", "_creationTime"])
    ),
    contentReleases: (await ctx.db.query("contentReleases").collect()).map(
      (row) => Struct.omit(row, ["_id", "_creationTime"])
    ),
    contentHeads: (await ctx.db.query("contentHeads").collect()).map((row) =>
      Struct.omit(row, ["_id", "_creationTime"])
    ),
    contentBindings: (await ctx.db.query("contentBindings").collect()).map(
      (row) => Struct.omit(row, ["_id", "_creationTime"])
    ),
    contentArtifacts: (await ctx.db.query("contentArtifacts").collect()).map(
      (row) => Struct.omit(row, ["_id", "_creationTime"])
    ),
    contentSnapshots: (await ctx.db.query("contentSnapshots").collect()).map(
      (row) => Struct.omit(row, ["_id", "_creationTime"])
    ),
    tryoutCatalog: (await ctx.db.query("tryoutCatalog").collect()).map((row) =>
      Struct.omit(row, ["_id", "_creationTime"])
    ),
    tryoutPlacements: (await ctx.db.query("tryoutPlacements").collect()).map(
      (row) => Struct.omit(row, ["_id", "_creationTime"])
    ),
    tryoutRuntimeBundles: (
      await ctx.db.query("tryoutRuntimeBundles").collect()
    ).map((row) => Struct.omit(row, ["_id", "_creationTime"])),
  };
}

/** Makes two sections and three placements so ordering affects real set reads. */
function orderedFixture(visibility: "visible" | "internal-entry") {
  if (visibility === "internal-entry") {
    return {
      catalog: ACTIVE_APP_LOCALES.flatMap((locale) =>
        makeTryoutStartHierarchy(locale, visibility)
      ),
      placements: ACTIVE_APP_LOCALES.map(makeTryoutStartPlacement),
    };
  }
  const setPath = "try-out/indonesia/tka/matematika/set-1";
  const catalog = ACTIVE_APP_LOCALES.flatMap((locale) =>
    makeTryoutStartHierarchy(locale, visibility).flatMap(
      (row): readonly TryoutCatalogRow[] => {
        if (row.kind === "track" || row.kind === "set") {
          return [
            {
              ...row,
              questionCount: 3,
              sectionCount: 2,
              visibleSectionCount: 2,
            },
          ];
        }
        if (row.kind !== "section") {
          return [row];
        }
        return [
          { ...row, questionCount: 2 },
          Schema.decodeSync(TryoutCatalogRowSchema)({
            ...row,
            graph: {
              ...row.graph,
              assetId: `${row.graph.assetId}:second`,
              alignmentId: `${row.graph.alignmentId}:second`,
            },
            order: 2,
            sectionKey: "aljabar",
            publicPath: `${setPath}/aljabar`,
            questionSourcePath: row.questionSourcePath.replace(
              "/matematika/",
              "/aljabar/"
            ),
            title: "Aljabar",
            visibility: "visible",
          }),
        ];
      }
    )
  );
  const placements = ACTIVE_APP_LOCALES.flatMap((locale) => [
    makeTryoutStartPlacement(locale),
    ...[
      { sectionKey: "matematika", questionOrder: 2 },
      { sectionKey: "aljabar", questionOrder: 1 },
    ].map(({ sectionKey, questionOrder }) => {
      const root = `question-bank/tryout/indonesia/tka/${sectionKey}/set-1/question-${questionOrder}`;
      return Schema.decodeSync(TryoutPlacementSchema)({
        ...makeTryoutStartPlacement(locale),
        sectionKey,
        questionOrder,
        questionSourcePath: `packages/corpus/${root}`,
        questionContentKey: `${root}/question`,
        answerContentKey: `${root}/answer`,
        questionArtifactHash: testTextHash(`${locale}:${root}:question`),
        answerArtifactHash: testTextHash(`${locale}:${root}:answer`),
      });
    }),
  ]);
  const advancedPath = "try-out/indonesia/tka/advanced";
  const advanced = catalog.flatMap((row) => {
    if (row.kind === "country" || row.kind === "exam") {
      return [];
    }
    let publicPath = advancedPath;
    if (row.kind !== "track") {
      publicPath += "/set-1";
    }
    if (row.kind === "section") {
      publicPath += `/${row.sectionKey}`;
    }
    return [
      Schema.decodeSync(TryoutCatalogRowSchema)({
        ...row,
        trackKey: "advanced",
        graph: {
          ...row.graph,
          assetId: `${row.graph.assetId}:advanced`,
          alignmentId: `${row.graph.alignmentId}:advanced`,
        },
        publicPath,
      }),
    ];
  });
  return {
    catalog: [...catalog, ...advanced],
    placements: [
      ...placements,
      ...placements.map((row) => ({ ...row, trackKey: "advanced" })),
    ],
  };
}

describe("portable try-out reads", () => {
  it.effect(
    "matches native localized catalogs, ordered sets, public pages, and exact references",
    () =>
      Effect.gen(function* () {
        for (const visibility of ["visible", "internal-entry"] as const) {
          const target = convexTest(schema, convexModules);
          const snapshotId = yield* Effect.promise(() =>
            target.mutation(async (ctx) => {
              const selected = await activateTryoutSnapshot(
                ctx,
                orderedFixture(visibility)
              );
              await insertTestTryoutRuntimeBundle(ctx, selected);
              return selected;
            })
          );
          const tables = yield* Effect.promise(() =>
            target.query(tryoutSnapshot)
          );
          const layer = Layer.merge(
            snapshotPublicationLayer(tables),
            snapshotTryoutLayer({
              ...tables,
              tryoutCatalog: [...tables.tryoutCatalog].reverse(),
              tryoutPlacements: [...tables.tryoutPlacements].reverse(),
            })
          );
          for (const appLocale of ACTIVE_APP_LOCALES) {
            const placement = makeTryoutStartPlacement(appLocale);
            const publicPath = "try-out/indonesia/tka/matematika/set-1";
            const identity = {
              locale: appLocale,
              countryKey: placement.countryKey,
              examKey: placement.examKey,
              trackKey: placement.trackKey,
              setKey: placement.setKey,
            };
            const program = Effect.gen(function* () {
              const source = yield* TryoutSource;
              const set = yield* readTryoutSet(identity);
              return {
                set,
                ...(yield* Effect.all({
                  catalog: readTryoutCatalog(appLocale),
                  page: readTryoutSetPage({ appLocale, publicPath }),
                  sectionPage: readTryoutSectionPage({
                    appLocale,
                    publicPath: `${publicPath}/matematika`,
                  }),
                  metadata: readTryoutMetadata({
                    appLocale,
                    publicPath,
                    kind: "set",
                  }),
                  reference: readTryoutReference({
                    kind: "route",
                    appLocale,
                    publicLocale: appLocale,
                    publicPath,
                    family: "tryout",
                  }),
                  boundedCatalog: source
                    .catalog(snapshotId, appLocale, 1)
                    .pipe(
                      Effect.map((rows) => rows.map(({ identity }) => identity))
                    ),
                  boundedSections: source
                    .sections(snapshotId, set.setIdentity, 1)
                    .pipe(Effect.map((rows) => rows.map(({ order }) => order))),
                  boundedPlacements: source
                    .placements(snapshotId, placement, 1)
                    .pipe(
                      Effect.map((rows) =>
                        rows.map(({ questionOrder }) => questionOrder)
                      )
                    ),
                  asset: source
                    .asset(snapshotId, appLocale, set.set.row.graph.assetId, 1)
                    .pipe(
                      Effect.map((rows) => rows.map(({ rowJson }) => rowJson))
                    ),
                  absentCatalog: source.catalog("absent", appLocale, 1),
                  absentSections: source.sections("absent", set.setIdentity, 1),
                  absentPlacements: source.placements("absent", placement, 1),
                  absentAsset: source.asset(
                    "absent",
                    appLocale,
                    set.set.row.graph.assetId,
                    1
                  ),
                })),
              };
            });
            const native = yield* Effect.promise(() =>
              target.query((ctx) =>
                runConvexProgram(
                  program.pipe(Effect.provide(convexTryoutLayer(ctx)))
                )
              )
            );
            const portable = yield* program.pipe(Effect.provide(layer));
            expect(portable).toEqual(native);
            expect(
              portable.set.sections.map(({ section, placements }) => [
                section.row.order,
                placements.map(({ row }) => row.questionOrder),
              ])
            ).toEqual(
              visibility === "visible"
                ? [
                    [1, [1, 2]],
                    [2, [1]],
                  ]
                : [[1, [1]]]
            );
            expect(portable.catalog.rowJson).toHaveLength(
              visibility === "visible" ? 10 : 5
            );
            expect(portable.boundedCatalog).toHaveLength(1);
            expect(portable.boundedSections).toEqual([1]);
            expect(portable.boundedPlacements).toEqual([1]);
            expect(portable.asset).toHaveLength(1);
            expect(portable.sectionPage === null).toBe(
              visibility === "internal-entry"
            );
            expect(portable.absentCatalog).toEqual([]);
            expect(portable.absentSections).toEqual([]);
            expect(portable.absentPlacements).toEqual([]);
            expect(portable.absentAsset).toEqual([]);
          }
        }
      })
  );

  it.effect(
    "rejects duplicate catalog identities or paths and tampered signed catalog rows",
    () =>
      Effect.gen(function* () {
        const target = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          target.mutation((ctx) =>
            activateTryoutStartSource(ctx, "internal-entry")
          )
        );
        const tables = yield* Effect.promise(() =>
          target.query(tryoutSnapshot)
        );
        const [row] = tables.tryoutCatalog;
        const internalEntry = tables.tryoutCatalog.find(
          (entry) => entry.publicPath === undefined
        );
        if (!(row && internalEntry)) {
          return yield* Effect.die(
            "Expected a signed try-out catalog fixture."
          );
        }
        for (const tryoutCatalog of [
          [...tables.tryoutCatalog, row],
          [...tables.tryoutCatalog, { ...row, identity: "different-identity" }],
          tables.tryoutCatalog.map((entry) =>
            entry === row ? { ...entry, rowJson: "{" } : entry
          ),
          tables.tryoutCatalog.map((entry) =>
            entry === row
              ? { ...entry, rowHash: testTextHash("changed") }
              : entry
          ),
        ]) {
          expect(
            yield* readTryoutCatalog(row.appLocale).pipe(
              Effect.provide(
                Layer.merge(
                  snapshotPublicationLayer(tables),
                  snapshotTryoutLayer({ ...tables, tryoutCatalog })
                )
              ),
              Effect.flip
            )
          ).toMatchObject({
            _tag: "ReleaseError",
            code: "CONTENT_RELEASE_INTEGRITY",
          });
        }
        const duplicateAsset = {
          ...internalEntry,
          identity: "different-identity",
        };
        expect(
          yield* readTryoutReference({
            kind: "content",
            contentId: internalEntry.assetId,
            appLocale: ActiveAppLocaleSchema.make(internalEntry.appLocale),
            publicLocale: internalEntry.appLocale,
            family: "tryout",
          }).pipe(
            Effect.provide(
              Layer.merge(
                snapshotPublicationLayer(tables),
                snapshotTryoutLayer({
                  ...tables,
                  tryoutCatalog: [...tables.tryoutCatalog, duplicateAsset],
                })
              )
            ),
            Effect.flip
          )
        ).toMatchObject({
          _tag: "ReleaseError",
          code: "CONTENT_RELEASE_INTEGRITY",
        });
      })
  );

  it.effect(
    "matches native protected artifact bytes and preserves exact snapshot membership",
    () =>
      Effect.gen(function* () {
        const target = convexTest(schema, convexModules);
        const fixture = yield* Effect.promise(() =>
          target.mutation(insertProtectedRuntime)
        );
        const tables = yield* Effect.promise(() =>
          target.query(tryoutSnapshot)
        );
        const layer = Layer.merge(
          snapshotPublicationLayer(tables),
          snapshotTryoutLayer(tables)
        );
        const program = readProtectedProgram(fixture.request);
        const native = yield* Effect.promise(() =>
          target.query((ctx) =>
            runConvexProgram(
              program.pipe(Effect.provide(convexTryoutLayer(ctx)))
            )
          )
        );
        const portable = yield* program.pipe(Effect.provide(layer));
        expect(portable).toEqual(native);
        expect(portable?.items.map(({ delivery }) => delivery)).toEqual([
          "authenticated",
          "entitled",
        ]);
        for (const request of [
          { ...fixture.request, snapshotId: testTextHash("other-snapshot") },
          { ...fixture.request, bundleHash: testTextHash("absent-bundle") },
          {
            ...fixture.request,
            selectors: [
              {
                ...fixture.question,
                artifactHash: testTextHash("absent-question"),
              },
            ],
          },
          {
            ...fixture.request,
            selectors: [
              {
                ...fixture.answer,
                artifactHash: testTextHash("absent-answer"),
              },
            ],
          },
        ]) {
          const read = readProtectedProgram(request).pipe(
            Effect.match({
              onSuccess: (value) => ({ status: "resolved" as const, value }),
              onFailure: ({ code }) => ({ status: "rejected" as const, code }),
            })
          );
          const expected = yield* Effect.promise(() =>
            target.query((ctx) =>
              runConvexProgram(
                read.pipe(Effect.provide(convexTryoutLayer(ctx)))
              )
            )
          );
          expect(yield* read.pipe(Effect.provide(layer))).toEqual(expected);
        }
        const [placement] = tables.tryoutPlacements;
        const [bundle] = tables.tryoutRuntimeBundles;
        if (!(placement && bundle)) {
          return yield* Effect.die(
            "Expected immutable protected runtime fixtures."
          );
        }
        for (const changed of [
          {
            ...tables,
            tryoutPlacements: [...tables.tryoutPlacements, placement],
          },
          {
            ...tables,
            tryoutRuntimeBundles: [...tables.tryoutRuntimeBundles, bundle],
          },
          {
            ...tables,
            tryoutPlacements: tables.tryoutPlacements.map((row) => ({
              ...row,
              rowHash: testTextHash("changed-placement"),
            })),
          },
        ]) {
          expect(
            yield* program.pipe(
              Effect.provide(
                Layer.merge(
                  snapshotPublicationLayer(changed),
                  snapshotTryoutLayer(changed)
                )
              ),
              Effect.flip
            )
          ).toMatchObject({
            _tag: "ReleaseError",
            code: "CONTENT_RELEASE_INTEGRITY",
          });
        }
      })
  );
});
