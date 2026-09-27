import { describe, expect, it } from "@effect/vitest";
import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { TryoutCatalogRowSchema } from "@nakafa/aksara-contracts/tryout/catalog";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { readSignedTryoutSearchDocuments } from "@repo/backend/confect/contents/helpers/search/tryout";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import {
  activateTryoutSnapshot,
  makeTryoutCatalogRow,
  makeTryoutPlacementRow,
} from "@repo/backend/test/tryout/snapshot";
import { Effect, Schema } from "effect";

/** Builds one internal section that must never become a public search result. */
function makeInternalSection(appLocale: ActiveAppLocaleCode) {
  return Schema.decodeSync(TryoutCatalogRowSchema)({
    countryKey: "indonesia",
    description: "Internal entry",
    examKey: "snbt",
    graph: {
      alignmentId: "alignment:tryout:technical:internal-section",
      assetId: `asset:${appLocale}:tryout:technical:internal-section`,
      conceptId: "concept:tryout:technical:internal-section",
      learningObjectId: "lo:tryout-technical-internal-section",
      lensId: "lens:tryout:technical",
    },
    kind: "section",
    appLocale,
    order: 1,
    questionCount: 1,
    questionSourcePath:
      "packages/corpus/question-bank/tryout/indonesia/snbt/quantitative-knowledge/set-1/question-1",
    sectionKey: "quantitative-knowledge",
    setKey: "set-1",
    sourceRevision: "technical-revision",
    timeLimitSeconds: 60,
    title: "Internal entry",
    trackKey: "2027",
    visibility: "internal-entry",
  });
}
describe("contents/helpers/search/tryout", () => {
  it.effect("returns no source fallback before signed Tryout activation", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          expect(
            yield* readSignedTryoutSearchDocuments(
              {
                limit: 10,
                locale: "en",
                offset: 0,
                queries: ["technical"],
                section: "tryout",
              },
              ["technical"],
              10
            )
          ).toEqual([]);
        })
      );
    })
  );
  it.effect(
    "searches only public rows from one verified localized catalog",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            yield* Effect.promise(() =>
              activateTryoutSnapshot(tCtx, {
                catalog: [
                  {
                    ...makeTryoutCatalogRow("en").record.row,
                    description: "Signed description",
                  },
                  makeInternalSection("en"),
                  makeTryoutCatalogRow("id").record.row,
                  makeInternalSection("id"),
                ],
                placements: [
                  makeTryoutPlacementRow("en").record.row,
                  makeTryoutPlacementRow("id").record.row,
                ],
              })
            );
            const input = {
              limit: 10,
              locale: "en",
              offset: 0,
              section: "tryout",
            } satisfies Parameters<typeof readSignedTryoutSearchDocuments>[0];
            const exact = yield* readSignedTryoutSearchDocuments(
              {
                ...input,
                queries: ["try-out/indonesia"],
              },
              ["try-out/indonesia"],
              10
            );
            const internal = yield* readSignedTryoutSearchDocuments(
              {
                ...input,
                queries: ["Internal entry"],
              },
              ["Internal entry"],
              10
            );
            const browsed = yield* readSignedTryoutSearchDocuments(
              input,
              [],
              10
            );
            const empty = yield* readSignedTryoutSearchDocuments(input, [], 0);
            expect(exact).toMatchObject([
              {
                content_id: "asset:en:tryout:technical:country",
                route: "try-out/indonesia",
                section: "tryout",
              },
            ]);
            expect(internal).toEqual([]);
            expect(browsed).toHaveLength(1);
            expect(empty).toEqual([]);
          })
        );
      })
  );
});
