import { RegisteredFunction } from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { getNakafaTaxonomy } from "@repo/backend/agent/taxonomy";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import type { api } from "@repo/backend/convex/_generated/api";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import {
  encodeTestQuranRow,
  makeQuranSurah,
} from "@repo/backend/test/quran/rows";
import { type FunctionReturnType, getFunctionName } from "convex/server";
import { Array as Arr, Effect } from "effect";

const PIN = {
  manifestHash: `sha256:${"1".repeat(64)}`,
  releaseId: "release-agent-taxonomy",
  sequence: 1,
};
const SNAPSHOT_ID = Sha256HashSchema.make(`sha256:${"2".repeat(64)}`);
type QuranCatalog = FunctionReturnType<typeof api.contentRelease.quran.surahs>;

/** Signs the 114 surah rows that the Quran catalog query returns. */
const makeCatalog = Effect.fn("test.agent.taxonomyCatalog")(function* () {
  const rowJson = yield* Effect.forEach(
    Array.from({ length: 114 }, (_, index) => index),
    (index) => encodeTestQuranRow(SNAPSHOT_ID, makeQuranSurah(index + 1))
  );
  return {
    activeManifestHash: PIN.manifestHash,
    activeReleaseId: PIN.releaseId,
    managed: true,
    rowJson,
    snapshotId: SNAPSHOT_ID,
    sourceOrigin: {
      kind: "git",
      sha: "a".repeat(40),
    },
    sourceRevision: "a".repeat(40),
  } satisfies QuranCatalog;
});

/** Models independent query responses while release activation may race the action. */
function queryResponses(
  ctx: ActionCtx,
  catalog: QuranCatalog,
  options: {
    readonly before?: typeof PIN | null;
    readonly after?: typeof PIN | null;
    readonly unmanaged?: "article taxonomy" | "article" | "material" | "quran";
    readonly malformed?: string;
  } = {}
) {
  let pinRead = 0;
  return vi.spyOn(ctx, "runQuery").mockImplementation((...[reference]) => {
    const name = getFunctionName(reference);
    if (name === options.malformed) {
      return Promise.resolve(false);
    }
    if (name === "contentRelease/runtime/active:read") {
      pinRead += 1;
      const pin = pinRead === 1 ? options.before : options.after;
      return Promise.resolve(pin === undefined ? PIN : pin);
    }
    if (name === "contentRelease/article/internal:readAgentTaxonomy") {
      return Promise.resolve({
        categories: ["politics"],
        managed: options.unmanaged !== "article taxonomy",
      });
    }
    if (name === "contentRelease/article:sitemapBuckets") {
      return Promise.resolve({
        activeReleaseId: PIN.releaseId,
        articleCount: 2,
        buckets: [],
        managed: options.unmanaged !== "article",
      });
    }
    if (name === "contentRelease/material:sitemapBuckets") {
      return Promise.resolve({
        activeReleaseId: PIN.releaseId,
        materialCount: 3,
        buckets: [],
        managed: options.unmanaged !== "material",
      });
    }
    if (name === "contentRelease/tryout:taxonomy") {
      return Promise.resolve({
        countries: [
          {
            id: "indonesia",
            label: "Indonesia",
          },
        ],
        exams: [
          {
            id: "snbt",
            label: "SNBT",
          },
        ],
        routeCount: 4,
      } satisfies FunctionReturnType<
        typeof api.contentRelease.tryout.taxonomy
      >);
    }
    if (name === "contentRelease/quran:surahs") {
      return Promise.resolve({
        ...catalog,
        managed: options.unmanaged !== "quran",
      });
    }
    return expect.fail(`Unexpected taxonomy query ${name}.`);
  });
}
describe("agent/taxonomy", () => {
  it.effect.each([
    "contentRelease/runtime/active:read",
    "contentRelease/article/internal:readAgentTaxonomy",
    "contentRelease/article:sitemapBuckets",
    "contentRelease/material:sitemapBuckets",
    "contentRelease/tryout:taxonomy",
    "contentRelease/quran:surahs",
  ])("rejects a malformed %s result before assembling taxonomy", (malformed) =>
    Effect.gen(function* () {
      const catalog = yield* makeCatalog();
      const runtimeServices = yield* Effect.context<never>();
      yield* Effect.promise(() =>
        createConvexTestWithBetterAuth().action(async (ctx) => {
          queryResponses(ctx, catalog, { malformed });
          const error = await Effect.runPromiseWith(runtimeServices)(
            getNakafaTaxonomy().pipe(
              Effect.flip,
              Effect.provide(RegisteredFunction.actionLayer(confectSchema, ctx))
            )
          );
          expect(error._tag).toBe("NakafaAgentDataReadError");
          expect(error.cause).toContain("Expected");
        })
      );
    })
  );
  it.effect.each([undefined, "en", "id", "de"] satisfies (
    | ActiveAppLocaleCode
    | undefined
  )[])(
    "returns complete ordered locale counts and selected taxonomy for %s",
    (locale) =>
      Effect.gen(function* () {
        const catalog = yield* makeCatalog();
        const runtimeServices = yield* Effect.context<never>();
        const test = createConvexTestWithBetterAuth();
        yield* Effect.promise(() =>
          test.action(async (ctx) => {
            const queries = queryResponses(ctx, catalog);
            const result = await Effect.runPromiseWith(runtimeServices)(
              getNakafaTaxonomy(locale).pipe(
                Effect.orDie,
                Effect.provide(
                  RegisteredFunction.actionLayer(confectSchema, ctx)
                )
              )
            );
            expect(result).toMatchObject({
              articles: {
                categories: ["politics"],
              },
              content_counts: [
                {
                  count: 123,
                  locale: "en",
                },
                {
                  count: 123,
                  locale: "id",
                },
                {
                  count: 123,
                  locale: "de",
                },
              ],
              default_locale: "en",
              locale: locale ?? "en",
              quran: {
                surah_count: 114,
              },
              tryout: {
                countries: [
                  {
                    id: "indonesia",
                    label: "Indonesia",
                  },
                ],
                exams: [
                  {
                    id: "snbt",
                    label: "SNBT",
                  },
                ],
              },
            });
            const taxonomyLocales = Arr.map(
              Arr.filter(
                queries.mock.calls,
                ([reference]) =>
                  getFunctionName(reference) ===
                  "contentRelease/tryout:taxonomy"
              ),
              ([, args]) => args
            );
            expect(taxonomyLocales).toHaveLength(3);
            expect(taxonomyLocales).toContainEqual({
              appLocale: locale ?? "en",
            });
          })
        );
      })
  );
  it.effect.each(["article taxonomy", "article", "material", "quran"] as const)(
    "fails closed when signed %s inventory is unavailable",
    (unmanaged) =>
      Effect.gen(function* () {
        const catalog = yield* makeCatalog();
        const runtimeServices = yield* Effect.context<never>();
        const test = createConvexTestWithBetterAuth();
        yield* Effect.promise(() =>
          test.action(async (ctx) => {
            queryResponses(ctx, catalog, {
              unmanaged,
            });
            const failure = await Effect.runPromiseWith(runtimeServices)(
              getNakafaTaxonomy().pipe(
                Effect.flip,
                Effect.orDie,
                Effect.provide(
                  RegisteredFunction.actionLayer(confectSchema, ctx)
                )
              )
            );
            expect(failure._tag).toBe("NakafaAgentDataReadError");
            expect(failure.cause).toContain(
              unmanaged === "quran" ? "not active" : "unmanaged"
            );
          })
        );
      })
  );
  it.effect.each([
    {
      before: PIN,
      after: {
        ...PIN,
        manifestHash: `sha256:${"3".repeat(64)}`,
      },
    },
    {
      before: PIN,
      after: {
        ...PIN,
        releaseId: "release-agent-next",
      },
    },
    {
      before: PIN,
      after: {
        ...PIN,
        sequence: 2,
      },
    },
    {
      before: PIN,
      after: null,
    },
    {
      before: null,
      after: PIN,
    },
  ])(
    "rejects inventories assembled across a release transition: %j",
    (options) =>
      Effect.gen(function* () {
        const catalog = yield* makeCatalog();
        const runtimeServices = yield* Effect.context<never>();
        const test = createConvexTestWithBetterAuth();
        yield* Effect.promise(() =>
          test.action(async (ctx) => {
            queryResponses(ctx, catalog, options);
            const failure = await Effect.runPromiseWith(runtimeServices)(
              getNakafaTaxonomy().pipe(
                Effect.flip,
                Effect.orDie,
                Effect.provide(
                  RegisteredFunction.actionLayer(confectSchema, ctx)
                )
              )
            );
            expect(failure).toMatchObject({
              _tag: "NakafaAgentDataReadError",
              cause:
                "The active Nakafa content release changed during the read.",
            });
          })
        );
      })
  );
});
