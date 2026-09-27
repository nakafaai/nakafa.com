import { describe, expect, it } from "@effect/vitest";
import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { TryoutCatalogRowSchema } from "@nakafa/aksara-contracts/tryout/catalog";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { tryoutLayer } from "@repo/backend/content/tryout/confect";
import {
  readTryoutSitemapCount,
  readTryoutSitemapPage,
} from "@repo/backend/content/tryout/sitemap";
import {
  activateTryoutSnapshot,
  makeTryoutCatalogRow,
  makeTryoutPlacementRow,
} from "@repo/backend/test/tryout/snapshot";
import { Effect, Schema } from "effect";

/** Creates one public country row with a deterministic technical identity. */
function makeCountry(
  locale: ActiveAppLocaleCode,
  countryKey: string,
  publicPath: string,
  order: number
) {
  const source = makeTryoutCatalogRow(locale).record.row;
  if (source.kind !== "country") {
    throw new Error("Expected the shared try-out fixture to be a country.");
  }
  return Schema.decodeSync(TryoutCatalogRowSchema)({
    ...source,
    countryKey,
    graph: {
      ...source.graph,
      assetId: `asset:${locale}:tryout:${countryKey}:country`,
      learningObjectId: `lo:tryout-${countryKey}-country`,
    },
    order,
    publicPath,
  });
}

/** Creates one internal entry section that must never enter a sitemap. */
function makeInternalSection(locale: ActiveAppLocaleCode) {
  const source = makeTryoutCatalogRow(locale).record.row;
  return Schema.decodeSync(TryoutCatalogRowSchema)({
    countryKey: "indonesia",
    examKey: "snbt",
    graph: {
      ...source.graph,
      assetId: `asset:${locale}:tryout:entry:section`,
      learningObjectId: "lo:tryout-entry-section",
    },
    kind: "section",
    appLocale: locale,
    order: 1,
    questionCount: 1,
    questionSourcePath:
      "packages/corpus/question-bank/tryout/indonesia/snbt/quantitative-knowledge/set-1",
    sectionKey: "quantitative-knowledge",
    setKey: "set-1",
    sourceRevision: "technical-revision",
    timeLimitSeconds: 60,
    title: "Technical entry section",
    trackKey: "2027",
    visibility: "internal-entry",
  });
}
describe("contentRelease/tryout/sitemap", () => {
  it.effect("requires an active signed try-out publication", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          expect(
            yield* readTryoutSitemapCount("en").pipe(
              Effect.provide(tryoutLayer),
              Effect.flip
            )
          ).toMatchObject({
            code: "CONTENT_RELEASE_MISSING",
          });
          expect(
            yield* readTryoutSitemapPage("en", 0).pipe(
              Effect.provide(tryoutLayer),
              Effect.flip
            )
          ).toMatchObject({
            code: "CONTENT_RELEASE_MISSING",
          });
        })
      );
    })
  );
  it.effect(
    "returns only sorted public paths from the active signed catalog",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            const catalog = [
              makeCountry("en", "zeta", "try-out/zeta", 2),
              makeCountry("en", "alpha", "try-out/alpha", 1),
              makeInternalSection("en"),
              makeCountry("id", "zeta", "try-out/zeta", 2),
              makeCountry("id", "alpha", "try-out/alpha", 1),
              makeInternalSection("id"),
              makeCountry("de", "zeta", "try-out/zeta", 2),
              makeCountry("de", "alpha", "try-out/alpha", 1),
              makeInternalSection("de"),
            ];
            yield* Effect.promise(() =>
              activateTryoutSnapshot(tCtx, {
                catalog,
                placements: [
                  makeTryoutPlacementRow("en").record.row,
                  makeTryoutPlacementRow("id").record.row,
                  makeTryoutPlacementRow("de").record.row,
                ],
              })
            );
            expect(
              yield* readTryoutSitemapCount("en").pipe(
                Effect.provide(tryoutLayer)
              )
            ).toEqual({
              pageCount: 1,
              routeCount: 2,
            });
            expect(
              yield* readTryoutSitemapPage("en", 0).pipe(
                Effect.provide(tryoutLayer)
              )
            ).toEqual({
              paths: ["try-out/alpha", "try-out/zeta"],
            });
            expect(
              yield* readTryoutSitemapPage("en", 1).pipe(
                Effect.provide(tryoutLayer)
              )
            ).toBeNull();
            expect(
              yield* readTryoutSitemapPage("en", -1).pipe(
                Effect.provide(tryoutLayer)
              )
            ).toBeNull();
          })
        );
      })
  );
});
