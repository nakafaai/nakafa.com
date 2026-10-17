import { DatabaseReader as ConfectDatabaseReader } from "@confect/server";
import { assert, describe, expect, it } from "@effect/vitest";
import {
  ACTIVE_APP_LOCALE_CODES,
  type ActiveAppLocaleCode,
} from "@nakafa/aksara-contracts/locale";
import { TryoutCatalogRowSchema } from "@nakafa/aksara-contracts/tryout/catalog";
import {
  type TryoutPlacement,
  TryoutPlacementSchema,
} from "@nakafa/aksara-contracts/tryout/placement";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { convexModules } from "@repo/backend/confect/test.setup";
import { tryoutLayer } from "@repo/backend/content/tryout/confect";
import {
  readTryoutSection,
  readTryoutSectionRows,
  type TryoutSectionIdentity,
} from "@repo/backend/content/tryout/section";
import schema from "@repo/backend/convex/schema";
import {
  activateTryoutSnapshot,
  makeTryoutCatalogRow,
  makeTryoutPlacementRow,
} from "@repo/backend/test/tryout/snapshot";
import { convexTest } from "convex-test";
import { Array as Arr, Effect, Layer, Option, Schema } from "effect";

const identity: TryoutSectionIdentity = {
  countryKey: "indonesia",
  examKey: "snbt",
  locale: "en",
  sectionKey: "quantitative-knowledge",
  setKey: "set-1",
  trackKey: "2027",
};
const technicalTitles = {
  de: "Technischer Abschnitt",
  en: "Technical section",
  id: "Bagian teknis",
} as const satisfies Record<ActiveAppLocaleCode, string>;

/** Creates one technical section with an explicit signed question count. */
function makeTechnicalSection(locale: ActiveAppLocaleCode, questionCount = 1) {
  return Schema.decodeSync(TryoutCatalogRowSchema)({
    ...identity,
    graph: {
      alignmentId: "alignment:tryout:technical:section",
      assetId: `asset:${locale}:tryout:technical:section`,
      conceptId: "concept:tryout:technical:section",
      learningObjectId: "lo:tryout-technical-section",
      lensId: "lens:tryout:technical",
    },
    kind: "section",
    appLocale: locale,
    order: 1,
    publicPath: "try-out/indonesia/snbt/2027/set-1/quantitative-knowledge",
    questionCount,
    questionSourcePath:
      "packages/corpus/question-bank/tryout/indonesia/snbt/quantitative-knowledge/set-1",
    sourceRevision: "technical-revision",
    timeLimitSeconds: 60,
    title: technicalTitles[locale],
    visibility: "visible",
  });
}

/** Moves one technical placement to another valid authored order. */
function makeTechnicalPlacement(
  placement: TryoutPlacement,
  questionOrder: number
) {
  const questionRoot = `question-bank/tryout/indonesia/snbt/quantitative-knowledge/set-1/question-${questionOrder}`;
  return Schema.decodeSync(TryoutPlacementSchema)({
    ...placement,
    answerContentKey: `${questionRoot}/answer`,
    questionContentKey: `${questionRoot}/question`,
    questionOrder,
    questionSourcePath: `packages/corpus/${questionRoot}`,
  });
}

/** Creates the signed country and question placement rows of one locale. */
const makeLocaleRows = Effect.fn("test.tryout.section.localeRows")(function* (
  locale: ActiveAppLocaleCode
) {
  return {
    country: (yield* makeTryoutCatalogRow(locale)).record.row,
    placement: (yield* makeTryoutPlacementRow(locale)).record.row,
  };
});

/** Activates one complete technical section in every active locale. */
const activateSection = Effect.fn("test.tryout.section.activate")(function* (
  questionCount = 1
) {
  const t = convexTest(schema, convexModules);
  const runtimeServices = yield* Effect.context<never>();
  const rows = yield* Effect.forEach(ACTIVE_APP_LOCALE_CODES, makeLocaleRows);
  const snapshotId = yield* Effect.promise(() =>
    t.mutation((ctx) =>
      Effect.runPromiseWith(runtimeServices)(
        activateTryoutSnapshot(ctx, {
          catalog: Arr.flatMap(rows, ({ country }) => [
            country,
            makeTechnicalSection(country.appLocale, questionCount),
          ]),
          placements: Arr.map(rows, ({ placement }) => placement),
        })
      )
    )
  );
  return {
    snapshotId,
    t,
  };
});
describe("contentRelease/tryout/section", () => {
  it.effect(
    "rejects an authenticated country row at the section-only boundary",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const { snapshotId, t } = yield* activateSection();
        yield* Effect.promise(() =>
          expect(
            t.query(async (ctx) => {
              const row = await ctx.db
                .query("tryoutCatalog")
                .filter((query) =>
                  query.and(
                    query.eq(query.field("appLocale"), "en"),
                    query.eq(query.field("kind"), "country")
                  )
                )
                .unique();
              if (row === null) {
                return null;
              }
              return Effect.runPromiseWith(runtimeServices)(
                readTryoutSectionRows(snapshotId, row).pipe(
                  Effect.provide(
                    Layer.provideMerge(
                      tryoutLayer,
                      ConfectDatabaseReader.layer(confectSchema, ctx.db)
                    )
                  )
                )
              );
            })
          ).rejects.toMatchObject({
            code: "CONTENT_RELEASE_INTEGRITY",
            message: expect.stringContaining("changed its row kind"),
          })
        );
      })
  );
  it.effect(
    "returns one verified server-only section with signed placements",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const { snapshotId, t } = yield* activateSection();
        yield* Effect.promise(() =>
          expect(
            t.query((ctx) =>
              Effect.runPromiseWith(runtimeServices)(
                readTryoutSection(identity).pipe(
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
            placements: [
              {
                row: {
                  countryKey: "indonesia",
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
            snapshotId,
          })
        );
      })
  );
  it.effect("fails closed until try-out ownership becomes active", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        expect(
          t.query((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              readTryoutSection(identity).pipe(
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
        })
      );
    })
  );
  it.effect("fails closed for a missing section or placement", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const missingSection = yield* activateSection();
      const missingPlacement = yield* activateSection();
      yield* Effect.promise(async () => {
        await expect(
          missingSection.t.query((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              readTryoutSection({
                ...identity,
                sectionKey: "missing",
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
        await missingPlacement.t.mutation(async (ctx) => {
          const placements = await ctx.db.query("tryoutPlacements").collect();
          const placement = Arr.findFirst(
            placements,
            ({ appLocale }) => appLocale === "en"
          );
          assert(Option.isSome(placement), "Expected one technical placement.");
          await ctx.db.delete(placement.value._id);
        });
        await expect(
          missingPlacement.t.query((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              readTryoutSection(identity).pipe(
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
    })
  );
  it.effect("rejects a section above the bounded placement limit", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const { t } = yield* activateSection(257);
      yield* Effect.promise(() =>
        expect(
          t.query((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              readTryoutSection(identity).pipe(
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
        })
      );
    })
  );
  it.effect(
    "rejects a signed placement that breaks contiguous section order",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const t = convexTest(schema, convexModules);
        const rows = yield* Effect.forEach(
          ACTIVE_APP_LOCALE_CODES,
          makeLocaleRows
        );
        yield* Effect.promise(async () => {
          await t.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              activateTryoutSnapshot(ctx, {
                catalog: Arr.flatMap(rows, ({ country }) => [
                  country,
                  makeTechnicalSection(country.appLocale),
                ]),
                placements: Arr.map(rows, ({ placement }) =>
                  placement.appLocale === "en"
                    ? makeTechnicalPlacement(placement, 2)
                    : placement
                ),
              })
            )
          );
          await expect(
            t.query((ctx) =>
              Effect.runPromiseWith(runtimeServices)(
                readTryoutSection(identity).pipe(
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
      })
  );
});
