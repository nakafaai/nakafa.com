import { describe, expect, it } from "@effect/vitest";
import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { TryoutCatalogRowSchema } from "@nakafa/aksara-contracts/tryout/catalog";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { readTryoutTaxonomy } from "@repo/backend/confect/contentRelease/tryout/taxonomy";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import {
  activateTryoutSnapshot,
  makeTryoutCatalogRow,
  makeTryoutPlacementRow,
} from "@repo/backend/test/tryout/snapshot";
import { Effect, Schema } from "effect";

/** Builds one localized technical exam beneath the shared country fixture. */
function makeTryoutExam(locale: ActiveAppLocaleCode) {
  const descriptions = {
    de: "Technische Prüfung",
    en: "Technical exam",
    id: "Ujian teknis",
  } satisfies Record<ActiveAppLocaleCode, string>;
  return Schema.decodeSync(TryoutCatalogRowSchema)({
    countryKey: "indonesia",
    description: descriptions[locale],
    examKey: "snbt",
    graph: {
      alignmentId: "alignment:tryout:technical:exam",
      assetId: `asset:${locale}:tryout:technical:exam`,
      conceptId: "concept:tryout:technical:exam",
      learningObjectId: "lo:tryout-technical-exam",
      lensId: "lens:tryout:technical",
    },
    kind: "exam",
    appLocale: locale,
    order: 1,
    publicPath: "try-out/indonesia/snbt",
    scoringStrategy: "irt",
    sourceRevision: "technical-revision",
    title: "SNBT",
  });
}
describe("contentRelease/tryout/taxonomy", () => {
  it.effect("requires one active signed Tryout publication", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          expect(
            yield* readTryoutTaxonomy("en").pipe(Effect.flip)
          ).toMatchObject({
            code: "CONTENT_RELEASE_MISSING",
          });
        })
      );
    })
  );
  it.effect(
    "derives localized options and route count from one verified catalog",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            yield* Effect.promise(() =>
              activateTryoutSnapshot(tCtx, {
                catalog: [
                  makeTryoutCatalogRow("en").record.row,
                  makeTryoutExam("en"),
                  makeTryoutCatalogRow("id").record.row,
                  makeTryoutExam("id"),
                  makeTryoutCatalogRow("de").record.row,
                  makeTryoutExam("de"),
                ],
                placements: [
                  makeTryoutPlacementRow("en").record.row,
                  makeTryoutPlacementRow("id").record.row,
                  makeTryoutPlacementRow("de").record.row,
                ],
              })
            );
            expect(yield* readTryoutTaxonomy("id")).toEqual({
              countries: [
                {
                  id: "indonesia",
                  label: "Negara teknis",
                },
              ],
              exams: [
                {
                  id: "snbt",
                  label: "SNBT",
                },
              ],
              routeCount: 2,
            });
          })
        );
      })
  );
});
