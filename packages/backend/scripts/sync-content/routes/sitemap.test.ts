import { internal } from "@repo/backend/convex/_generated/api";
import { computeHash } from "@repo/backend/scripts/lib/mdx-parser/content";
import type { ConvexConfig } from "@repo/backend/scripts/sync-content/contract/types";
import { buildPublicRouteProjection } from "@repo/backend/scripts/sync-content/routes/rows";
import {
  type PublicRoute,
  PublicRouteSchema,
} from "@repo/contents/_types/route/schema";
import { type FunctionReference, getFunctionName } from "convex/server";
import { Effect, Schema } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

const config: ConvexConfig = {
  accessToken: "test-token",
  url: "https://example.convex.cloud",
};

/** Loads the sitemap sync module with bounded Convex call fakes. */
interface StoredSitemapCount {
  count: number;
  hash: string;
  locale: "en" | "id";
  pageCount: number;
  syncedAt: number;
}

/** Loads the sitemap sync module with configurable committed locale counts. */
async function loadSitemapScript(
  storedCounts: Partial<Record<"en" | "id", StoredSitemapCount>> = {}
) {
  const mutationCalls: { args: unknown; name: string }[] = [];
  const deleteMutationName = getFunctionName(
    internal.contentSync.publicRoutes.internal.deleteOlderSitemapPages
  );

  vi.doMock("@repo/backend/scripts/sync-content/convex/client", () => ({
    callConvexMutation: (
      _config: ConvexConfig,
      functionReference: FunctionReference<"mutation", "internal" | "public">,
      args: unknown
    ) => {
      const functionName = getFunctionName(functionReference);
      mutationCalls.push({ args, name: functionName });

      if (functionName === deleteMutationName) {
        return Effect.succeed({ deleted: 0 });
      }

      return Effect.succeed({ created: 1, unchanged: 0, updated: 0 });
    },
    callConvexQuery: (
      _config: ConvexConfig,
      _functionReference: FunctionReference<"query", "internal" | "public">,
      args: { locale: "en" | "id" }
    ) => Effect.succeed(storedCounts[args.locale] ?? null),
  }));

  const sitemap = await import(
    "@repo/backend/scripts/sync-content/routes/sitemap"
  );

  return { mutationCalls, sitemap };
}

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("sync-content public sitemap", () => {
  it("includes only routes owned by the public sitemap", async () => {
    const { sitemap } = await loadSitemapScript();
    const projection = await Effect.runPromise(
      buildPublicRouteProjection([
        articleCategoryRoute("articles/politics"),
        curriculumRoute("curriculum/fixture/topic"),
        subjectLessonRoute("subjects/fixture/topic/lesson"),
      ])
    );

    const artifacts = await Effect.runPromise(
      sitemap.buildPublicSitemapArtifacts(projection, 42)
    );
    const english = artifacts.find((artifact) => artifact.locale === "en");

    expect(english?.pages.flatMap((page) => page.paths)).toEqual([
      "articles/politics",
      "curriculum/fixture/topic",
    ]);
  });

  it("builds deterministic thousand-route pages per locale", async () => {
    const { sitemap } = await loadSitemapScript();
    const routes = Array.from({ length: 1001 }, (_, index) =>
      curriculumRoute(
        `curriculum/fixture/topic-${index.toString().padStart(4, "0")}`
      )
    );
    routes.push(curriculumRoute("curriculum/fixture/private", false));
    routes.push(curriculumRoute("kurikulum/fixture/topik-0000", true, "id"));

    const projection = await Effect.runPromise(
      buildPublicRouteProjection(routes)
    );
    const artifacts = await Effect.runPromise(
      sitemap.buildPublicSitemapArtifacts(projection, 42)
    );
    const english = artifacts.find((artifact) => artifact.locale === "en");
    const indonesian = artifacts.find((artifact) => artifact.locale === "id");

    expect(english).toMatchObject({ count: 1001 });
    expect(english?.pages).toEqual([
      expect.objectContaining({
        page: 0,
        paths: expect.arrayContaining([
          "curriculum/fixture/topic-0000",
          "curriculum/fixture/topic-0999",
        ]),
      }),
      expect.objectContaining({
        page: 1,
        paths: ["curriculum/fixture/topic-1000"],
      }),
    ]);
    expect(english?.pages[0]?.paths).toHaveLength(1000);
    expect(indonesian).toMatchObject({ count: 1 });
  });

  it("commits each locale count after its pages and before stale cleanup", async () => {
    const { mutationCalls, sitemap } = await loadSitemapScript();
    const projection = await Effect.runPromise(
      buildPublicRouteProjection([
        curriculumRoute("curriculum/fixture/topic-0000"),
      ])
    );

    await Effect.runPromise(
      sitemap.syncPublicSitemapArtifacts(config, projection)
    );

    const englishCalls = mutationCalls.slice(0, 3).map((call) => call.name);

    expect(englishCalls).toEqual([
      getFunctionName(
        internal.contentSync.publicRoutes.internal.syncSitemapPages
      ),
      getFunctionName(
        internal.contentSync.publicRoutes.internal.saveSitemapCount
      ),
      getFunctionName(
        internal.contentSync.publicRoutes.internal.deleteOlderSitemapPages
      ),
    ]);
  });

  it("cleans older pages even when the committed projection is unchanged", async () => {
    const publicPath = "curriculum/fixture/topic-0000";
    const emptyHash = computeHash(JSON.stringify({ paths: [], version: 2 }));
    const { mutationCalls, sitemap } = await loadSitemapScript({
      en: {
        count: 1,
        hash: computeHash(JSON.stringify({ paths: [publicPath], version: 2 })),
        locale: "en",
        pageCount: 1,
        syncedAt: 41,
      },
      id: {
        count: 0,
        hash: emptyHash,
        locale: "id",
        pageCount: 0,
        syncedAt: 42,
      },
    });
    const projection = await Effect.runPromise(
      buildPublicRouteProjection([curriculumRoute(publicPath)])
    );

    await Effect.runPromise(
      sitemap.syncPublicSitemapArtifacts(config, projection)
    );

    expect(mutationCalls).toEqual([
      {
        args: { committedSyncedAt: 41, locale: "en" },
        name: getFunctionName(
          internal.contentSync.publicRoutes.internal.deleteOlderSitemapPages
        ),
      },
      {
        args: { committedSyncedAt: 42, locale: "id" },
        name: getFunctionName(
          internal.contentSync.publicRoutes.internal.deleteOlderSitemapPages
        ),
      },
    ]);
  });
});

/** Builds one schema-validated article category route fixture. */
function articleCategoryRoute(publicPath: string): PublicRoute {
  return Schema.decodeUnknownSync(PublicRouteSchema)({
    category: "politics",
    kind: "article-category",
    locale: "en",
    publicPath,
    sitemap: true,
    title: publicPath,
  });
}

/** Builds one schema-validated material lesson route fixture. */
function subjectLessonRoute(publicPath: string): PublicRoute {
  return Schema.decodeUnknownSync(PublicRouteSchema)({
    kind: "subject-lesson",
    locale: "en",
    materialKey: "lesson.fixture",
    parentPath: "subjects/fixture/topic",
    publicPath,
    sitemap: true,
    sourcePath: "material/lesson/fixture/topic/lesson",
    title: publicPath,
  });
}

/** Builds one schema-validated curriculum route fixture. */
function curriculumRoute(
  publicPath: string,
  sitemap = true,
  locale: "en" | "id" = "en"
): PublicRoute {
  return Schema.decodeUnknownSync(PublicRouteSchema)({
    iconKey: "mathematics",
    kind: "curriculum-context",
    level: "topic",
    locale,
    nodeKey: publicPath,
    order: 0,
    programKey: "merdeka",
    publicPath,
    sitemap,
    title: publicPath,
  });
}
