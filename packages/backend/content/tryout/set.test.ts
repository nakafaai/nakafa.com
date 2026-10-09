import { DatabaseReader as ConfectDatabaseReader } from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import {
  ACTIVE_APP_LOCALE_CODES,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import {
  type TryoutCatalogRow,
  TryoutCatalogRowSchema,
} from "@nakafa/aksara-contracts/tryout/catalog";
import { tryoutCatalogNodeIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { TRYOUT_SET_QUESTION_LIMIT } from "@repo/backend/confect/contentRelease/tryout/limits";
import { convexModules } from "@repo/backend/confect/test.setup";
import { tryoutLayer } from "@repo/backend/content/tryout/confect";
import {
  readTryoutSet,
  type TryoutSetIdentity,
} from "@repo/backend/content/tryout/set";
import schema from "@repo/backend/convex/schema";
import { activateTryoutSnapshot } from "@repo/backend/test/tryout/snapshot";
import {
  makeTryoutStartCatalog,
  makeTryoutStartPlacement,
  TRYOUT_START_COUNTRY,
  TRYOUT_START_EXAM,
  TRYOUT_START_SECTION,
  TRYOUT_START_SET,
  TRYOUT_START_TRACK,
} from "@repo/backend/test/tryout/source";
import { convexTest } from "convex-test";
import { Array as Arr, Effect, Layer, Schema } from "effect";

const identity: TryoutSetIdentity = {
  countryKey: TRYOUT_START_COUNTRY,
  examKey: TRYOUT_START_EXAM,
  locale: "id",
  setKey: TRYOUT_START_SET,
  trackKey: TRYOUT_START_TRACK,
};

/** Activates one complete signed start fixture in every active locale. */
async function activateSet(
  transform: (
    rows: readonly TryoutCatalogRow[]
  ) => readonly TryoutCatalogRow[] = (rows) => rows,
  visibility: "internal-entry" | "visible" = "visible"
) {
  const t = convexTest(schema, convexModules);
  const catalog = transform(
    Arr.flatMap(ACTIVE_APP_LOCALE_CODES, (locale) =>
      makeTryoutStartCatalog(locale, visibility)
    )
  );
  const snapshotId = await t.mutation((ctx) =>
    activateTryoutSnapshot(ctx, {
      catalog,
      placements: Arr.map(ACTIVE_APP_LOCALE_CODES, makeTryoutStartPlacement),
    })
  );
  return {
    snapshotId,
    t,
  };
}
describe("contentRelease/tryout/set", () => {
  it.effect(
    "rejects more signed sections than questions and an incomplete section inventory",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        for (const questionCount of [1, 2]) {
          const { t } = yield* Effect.promise(() =>
            activateSet((rows) =>
              Arr.map(rows, (row) =>
                Schema.decodeSync(TryoutCatalogRowSchema)(
                  row.kind === "set"
                    ? {
                        ...row,
                        sectionCount: 2,
                        visibleSectionCount: 2,
                        questionCount,
                      }
                    : row
                )
              )
            )
          );
          yield* Effect.promise(() =>
            expect(
              t.query((ctx) =>
                Effect.runPromiseWith(runtimeServices)(
                  readTryoutSet(identity).pipe(
                    Effect.provide(
                      Layer.provideMerge(
                        tryoutLayer,
                        ConfectDatabaseReader.layer(confectSchema, ctx.db)
                      )
                    )
                  )
                )
              )
            ).rejects.toMatchObject({
              code: "CONTENT_RELEASE_INTEGRITY",
            })
          );
        }
      })
  );
  it("returns one complete verified set and its signed sections", async () => {
    const { snapshotId, t } = await activateSet();
    await expect(
      t.query((ctx) =>
        Effect.runPromise(
          readTryoutSet(identity).pipe(
            Effect.provide(
              Layer.provideMerge(
                tryoutLayer,
                ConfectDatabaseReader.layer(confectSchema, ctx.db)
              )
            )
          )
        )
      )
    ).resolves.toMatchObject({
      sections: [
        {
          placements: [
            {
              row: {
                questionOrder: 1,
                scope: "server",
              },
            },
          ],
          section: {
            row: {
              kind: "section",
              questionCount: 1,
            },
          },
        },
      ],
      set: {
        row: {
          kind: "set",
          questionCount: 1,
          sectionCount: 1,
        },
      },
      setIdentity: expect.any(String),
      snapshotId,
    });
  });
  it("fails closed before publication or when the set is missing", async () => {
    const unpublished = convexTest(schema, convexModules);
    await expect(
      unpublished.query((ctx) =>
        Effect.runPromise(
          readTryoutSet(identity).pipe(
            Effect.provide(
              Layer.provideMerge(
                tryoutLayer,
                ConfectDatabaseReader.layer(confectSchema, ctx.db)
              )
            )
          )
        )
      )
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_MISSING",
    });
    const published = await activateSet();
    await expect(
      published.t.query((ctx) =>
        Effect.runPromise(
          readTryoutSet({
            ...identity,
            setKey: "missing",
          }).pipe(
            Effect.provide(
              Layer.provideMerge(
                tryoutLayer,
                ConfectDatabaseReader.layer(confectSchema, ctx.db)
              )
            )
          )
        )
      )
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_MISSING",
    });
  });
  it("rejects signed set counts that do not match their sections", async () => {
    const { t } = await activateSet((rows) =>
      Arr.map(rows, (row) => {
        if (row.kind !== "set") {
          return row;
        }
        return Schema.decodeSync(TryoutCatalogRowSchema)({
          ...row,
          questionCount: 2,
        });
      })
    );
    await expect(
      t.query((ctx) =>
        Effect.runPromise(
          readTryoutSet(identity).pipe(
            Effect.provide(
              Layer.provideMerge(
                tryoutLayer,
                ConfectDatabaseReader.layer(confectSchema, ctx.db)
              )
            )
          )
        )
      )
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_INTEGRITY",
    });
  });
  it("rejects a set whose indexed owner identity was changed", async () => {
    const { snapshotId, t } = await activateSet();
    const setIdentity = tryoutCatalogNodeIdentity({
      appLocale: AppLocaleSchema.make(identity.locale),
      countryKey: identity.countryKey,
      examKey: identity.examKey,
      kind: "set",
      setKey: identity.setKey,
      trackKey: identity.trackKey,
    });
    await t.mutation(async (ctx) => {
      const stored = await ctx.db
        .query("tryoutCatalog")
        .withIndex("by_snapshotId_and_identity", (index) =>
          index.eq("snapshotId", snapshotId).eq("identity", setIdentity)
        )
        .unique();
      if (!stored) {
        throw new Error("Expected one signed catalog row.");
      }
      await ctx.db.patch(stored._id, {
        setIdentity: "changed-set",
      });
    });
    await expect(
      t.query((ctx) =>
        Effect.runPromise(
          readTryoutSet(identity).pipe(
            Effect.provide(
              Layer.provideMerge(
                tryoutLayer,
                ConfectDatabaseReader.layer(confectSchema, ctx.db)
              )
            )
          )
        )
      )
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_INTEGRITY",
    });
  });
  it("rejects a set beyond the aggregate placement budget", async () => {
    const { t } = await activateSet((rows) =>
      Arr.map(rows, (row) => {
        if (row.kind !== "set") {
          return row;
        }
        return Schema.decodeSync(TryoutCatalogRowSchema)({
          ...row,
          questionCount: TRYOUT_SET_QUESTION_LIMIT + 1,
        });
      })
    );
    await expect(
      t.query((ctx) =>
        Effect.runPromise(
          readTryoutSet(identity).pipe(
            Effect.provide(
              Layer.provideMerge(
                tryoutLayer,
                ConfectDatabaseReader.layer(confectSchema, ctx.db)
              )
            )
          )
        )
      )
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_LIMIT",
    });
  });
  it("rejects an internal entry key bound to a visible section", async () => {
    const { t } = await activateSet((rows) =>
      Arr.map(rows, (row) => {
        if (row.kind !== "set") {
          return row;
        }
        return Schema.decodeSync(TryoutCatalogRowSchema)({
          ...row,
          internalEntrySectionKey: TRYOUT_START_SECTION,
          visibleSectionCount: 0,
        });
      })
    );
    await expect(
      t.query((ctx) =>
        Effect.runPromise(
          readTryoutSet(identity).pipe(
            Effect.provide(
              Layer.provideMerge(
                tryoutLayer,
                ConfectDatabaseReader.layer(confectSchema, ctx.db)
              )
            )
          )
        )
      )
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_INTEGRITY",
    });
  });
  it("rejects a set whose internal entry section is missing", async () => {
    const { t } = await activateSet(
      (rows) =>
        Arr.map(rows, (row) => {
          if (row.kind !== "set") {
            return row;
          }
          return Schema.decodeSync(TryoutCatalogRowSchema)({
            ...row,
            internalEntrySectionKey: "missing-entry-section",
          });
        }),
      "internal-entry"
    );
    await expect(
      t.query((ctx) =>
        Effect.runPromise(
          readTryoutSet(identity).pipe(
            Effect.provide(
              Layer.provideMerge(
                tryoutLayer,
                ConfectDatabaseReader.layer(confectSchema, ctx.db)
              )
            )
          )
        )
      )
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_INTEGRITY",
    });
  });
  it("returns one set with its declared internal entry section", async () => {
    const { t } = await activateSet((rows) => rows, "internal-entry");
    const set = await t.query((ctx) =>
      Effect.runPromise(
        readTryoutSet(identity).pipe(
          Effect.provide(
            Layer.provideMerge(
              tryoutLayer,
              ConfectDatabaseReader.layer(confectSchema, ctx.db)
            )
          )
        )
      )
    );
    expect(
      Arr.map(set.sections, ({ section }) => section.row.visibility)
    ).toContain("internal-entry");
  });
});
