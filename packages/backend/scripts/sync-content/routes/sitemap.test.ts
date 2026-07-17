import { internal } from "@repo/backend/convex/_generated/api";
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
async function loadSitemapScript() {
  const mutationCalls: string[] = [];
  const deleteMutationName = getFunctionName(
    internal.contentSync.publicRoutes.internal.deleteStaleSitemapPages
  );

  vi.doMock("@repo/backend/scripts/sync-content/convex/client", () => ({
    callConvexMutation: (
      _config: ConvexConfig,
      functionReference: FunctionReference<"mutation", "internal" | "public">
    ) => {
      const functionName = getFunctionName(functionReference);
      mutationCalls.push(functionName);

      if (functionName === deleteMutationName) {
        return Effect.succeed({ deleted: 0 });
      }

      return Effect.succeed({ created: 1, unchanged: 0, updated: 0 });
    },
    callConvexQuery: () => Effect.succeed(null),
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
        endPath: "curriculum/fixture/topic-0999",
        page: 0,
        routeCount: 1000,
        startPath: "curriculum/fixture/topic-0000",
      }),
      expect.objectContaining({
        endPath: "curriculum/fixture/topic-1000",
        page: 1,
        routeCount: 1,
        startPath: "curriculum/fixture/topic-1000",
      }),
    ]);
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

    const englishCalls = mutationCalls.slice(0, 3);

    expect(englishCalls).toEqual([
      getFunctionName(
        internal.contentSync.publicRoutes.internal.syncSitemapPages
      ),
      getFunctionName(
        internal.contentSync.publicRoutes.internal.saveSitemapCount
      ),
      getFunctionName(
        internal.contentSync.publicRoutes.internal.deleteStaleSitemapPages
      ),
    ]);
  });
});

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
