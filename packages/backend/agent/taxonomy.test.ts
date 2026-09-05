import { describe, expect, it } from "@effect/vitest";
import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { getNakafaTaxonomy } from "@repo/backend/agent/taxonomy";
import type { api } from "@repo/backend/convex/_generated/api";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  encodeTestQuranRow,
  makeQuranSurah,
} from "@repo/backend/test/quran/rows";
import { type FunctionReturnType, getFunctionName } from "convex/server";
import { Effect } from "effect";

const PIN = {
  manifestHash: `sha256:${"1".repeat(64)}`,
  releaseId: "release-agent-taxonomy",
  sequence: 1,
};
const SNAPSHOT_ID = Sha256HashSchema.make(`sha256:${"2".repeat(64)}`);
const CATALOG = {
  activeManifestHash: PIN.manifestHash,
  activeReleaseId: PIN.releaseId,
  managed: true,
  rowJson: Array.from({ length: 114 }, (_, index) =>
    encodeTestQuranRow(SNAPSHOT_ID, makeQuranSurah(index + 1))
  ),
  snapshotId: SNAPSHOT_ID,
  sourceOrigin: { kind: "git", sha: "a".repeat(40) },
  sourceRevision: "a".repeat(40),
} satisfies FunctionReturnType<typeof api.contentRelease.quran.surahs>;

/** Models independent query responses while release activation may race the action. */
function queryResponses(
  ctx: ActionCtx,
  options: {
    readonly before?: typeof PIN | null;
    readonly after?: typeof PIN | null;
    readonly unmanaged?: "article taxonomy" | "article" | "material" | "quran";
  } = {}
) {
  let pinRead = 0;
  return vi.spyOn(ctx, "runQuery").mockImplementation((...[reference]) => {
    const name = getFunctionName(reference);
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
        countries: [{ id: "indonesia", label: "Indonesia" }],
        exams: [{ id: "snbt", label: "SNBT" }],
        routeCount: 4,
      } satisfies FunctionReturnType<
        typeof api.contentRelease.tryout.taxonomy
      >);
    }
    if (name === "contentRelease/quran:surahs") {
      return Promise.resolve({
        ...CATALOG,
        managed: options.unmanaged !== "quran",
      });
    }
    return expect.fail(`Unexpected taxonomy query ${name}.`);
  });
}

describe("agent/taxonomy", () => {
  it.each([undefined, "en", "id", "de"] satisfies (
    | ActiveAppLocaleCode
    | undefined
  )[])(
    "returns complete ordered locale counts and selected taxonomy for %s",
    async (locale) => {
      const test = createConvexTestWithBetterAuth();
      await test.action(async (ctx) => {
        const queries = queryResponses(ctx);
        const result = await runConvexProgram(
          getNakafaTaxonomy(ctx, locale).pipe(Effect.orDie)
        );
        expect(result).toMatchObject({
          articles: { categories: ["politics"] },
          content_counts: [
            { count: 123, locale: "en" },
            { count: 123, locale: "id" },
            { count: 123, locale: "de" },
          ],
          default_locale: "en",
          locale: locale ?? "en",
          quran: { surah_count: 114 },
          tryout: {
            countries: [{ id: "indonesia", label: "Indonesia" }],
            exams: [{ id: "snbt", label: "SNBT" }],
          },
        });
        const taxonomyLocales = queries.mock.calls
          .filter(
            ([reference]) =>
              getFunctionName(reference) === "contentRelease/tryout:taxonomy"
          )
          .map(([, args]) => args);
        expect(taxonomyLocales).toHaveLength(3);
        expect(taxonomyLocales).toContainEqual({ appLocale: locale ?? "en" });
      });
    }
  );

  it.each(["article taxonomy", "article", "material", "quran"] as const)(
    "fails closed when signed %s inventory is unavailable",
    async (unmanaged) => {
      const test = createConvexTestWithBetterAuth();
      await test.action(async (ctx) => {
        queryResponses(ctx, { unmanaged });
        const failure = await runConvexProgram(
          getNakafaTaxonomy(ctx).pipe(Effect.flip, Effect.orDie)
        );
        expect(failure._tag).toBe("NakafaAgentDataReadError");
        expect(failure.cause).toContain(
          unmanaged === "quran" ? "not active" : "unmanaged"
        );
      });
    }
  );

  it.each([
    {
      before: PIN,
      after: { ...PIN, manifestHash: `sha256:${"3".repeat(64)}` },
    },
    { before: PIN, after: { ...PIN, releaseId: "release-agent-next" } },
    { before: PIN, after: { ...PIN, sequence: 2 } },
    { before: PIN, after: null },
    { before: null, after: PIN },
  ])(
    "rejects inventories assembled across a release transition: %j",
    async (options) => {
      const test = createConvexTestWithBetterAuth();
      await test.action(async (ctx) => {
        queryResponses(ctx, options);
        const failure = await runConvexProgram(
          getNakafaTaxonomy(ctx).pipe(Effect.flip, Effect.orDie)
        );
        expect(failure).toMatchObject({
          _tag: "NakafaAgentDataReadError",
          cause: "The active Nakafa content release changed during the read.",
        });
      });
    }
  );
});
