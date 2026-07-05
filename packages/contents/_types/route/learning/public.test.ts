import { readStaticPublicContentRoutes } from "@repo/contents/_types/route/content/static";
import { readStaticPublicCurriculumRoutes } from "@repo/contents/_types/route/curriculum/static";
import { createPublicLearningIndex } from "@repo/contents/_types/route/learning/public";
import type { PublicRoute } from "@repo/contents/_types/route/schema";
import { readStaticPublicTryoutRoutes } from "@repo/contents/_types/route/tryout/static";
import { describe, expect, it } from "vitest";

type MaterialLessonRoute = Extract<
  PublicRoute,
  { readonly kind: "subject-lesson" }
>;

/** Builds the production-shaped static route rows used by index tests. */
function readStaticRoutes() {
  return [
    ...readStaticPublicContentRoutes(),
    ...readStaticPublicCurriculumRoutes(),
    ...readStaticPublicTryoutRoutes(),
  ];
}

/** Fails a test when a required production route fixture disappears. */
function requireRoute(route: PublicRoute | undefined) {
  if (!route) {
    throw new Error("Expected production route fixture");
  }

  return route;
}

/** Fails a test unless the index returned a concrete material lesson route. */
function requireMaterialLessonRoute(
  route: PublicRoute | undefined
): MaterialLessonRoute {
  if (route?.kind !== "subject-lesson") {
    throw new Error("Expected production material lesson route fixture");
  }

  return route;
}

describe("createPublicLearningIndex", () => {
  it("resolves exact routes and try-out section locale projection by keyed lookup", () => {
    const index = createPublicLearningIndex({ routes: readStaticRoutes() });

    expect(
      index.resolveRouteByPath(
        "materi/ai-ds/metode-linear-ai/sistem-persamaan-linear",
        "id"
      )
    ).toMatchObject({
      kind: "subject-lesson",
      sourcePath: "material/lesson/ai-ds/linear-methods/system-linear-equation",
    });

    expect(
      index.resolveRouteByPath(
        "try-out/indonesia/snbt/set-1/pengetahuan-kuantitatif",
        "id"
      )
    ).toMatchObject({
      countryKey: "indonesia",
      examKey: "snbt",
      kind: "tryout-section",
      sectionKey: "quantitative-knowledge",
      setKey: "set-1",
    });

    const idTryoutRoute = requireRoute(
      index.resolveRouteByPath(
        "try-out/indonesia/snbt/set-1/pengetahuan-kuantitatif",
        "id"
      )
    );

    expect(index.projectRouteToLocale(idTryoutRoute, "en")).toMatchObject({
      publicPath: "try-out/indonesia/snbt/set-1/quantitative-knowledge",
    });
  });

  it("projects route rows to another locale by source identity", () => {
    const index = createPublicLearningIndex({ routes: readStaticRoutes() });
    const idRoute = requireMaterialLessonRoute(
      index.resolveRouteByPath(
        "materi/ai-ds/metode-linear-ai/sistem-persamaan-linear",
        "id"
      )
    );

    expect(index.projectRouteToLocale(idRoute, "en")).toMatchObject({
      publicPath: "subjects/ai-ds/linear-methods/system-linear-equation",
    });
  });

  it("preserves only valid material context when projecting localized material routes", () => {
    const index = createPublicLearningIndex({ routes: readStaticRoutes() });
    const idRoute = requireMaterialLessonRoute(
      index.resolveRouteByPath(
        "materi/matematika/eksponen-dan-logaritma/konsep-eksponen",
        "id"
      )
    );
    const enRoute = requireMaterialLessonRoute(
      index.projectRouteToLocale(idRoute, "en")
    );
    const context = {
      nodeKey: "class-10-mathematics-exponential-logarithm",
      programKey: "merdeka",
    };

    expect(
      index.projectMaterialContextToLocale({
        context,
        currentRoute: idRoute,
        targetRoute: enRoute,
      })
    ).toEqual(context);

    expect(
      index.projectMaterialContextToLocale({
        context: {
          nodeKey: "class-10-biology-virus-role",
          programKey: "merdeka",
        },
        currentRoute: idRoute,
        targetRoute: enRoute,
      })
    ).toBeUndefined();

    expect(
      index.projectMaterialContextToLocale({
        context,
        currentRoute: idRoute,
        targetRoute: requireMaterialLessonRoute(
          index.resolveRouteByPath("materi/fisika/vektor/konsep-vektor", "id")
        ),
      })
    ).toBeUndefined();
  });

  it("resolves contextual material header links from prebuilt context refs", () => {
    const index = createPublicLearningIndex({ routes: readStaticRoutes() });
    const route = requireMaterialLessonRoute(
      index.resolveRouteByPath(
        "materi/matematika/eksponen-dan-logaritma/konsep-eksponen",
        "id"
      )
    );

    expect(
      index.resolveMaterialHeaderLink({
        context: {
          nodeKey: "class-10-mathematics-exponential-logarithm",
          programKey: "merdeka",
        },
        route,
      })
    ).toEqual({
      href: "/id/kurikulum/merdeka/kelas-10/matematika#eksponen-dan-logaritma",
      label: "Eksponen dan Logaritma",
    });

    expect(
      index.resolveMaterialHeaderLink({
        context: undefined,
        route,
      })
    ).toBeUndefined();
  });

  it("adds material context queries only to validated target routes", () => {
    const index = createPublicLearningIndex({ routes: readStaticRoutes() });
    const route = requireMaterialLessonRoute(
      index.resolveRouteByPath(
        "materi/matematika/eksponen-dan-logaritma/konsep-eksponen",
        "id"
      )
    );
    const staleRoute = requireMaterialLessonRoute(
      index.resolveRouteByPath("materi/fisika/vektor/konsep-vektor", "id")
    );
    const context = {
      nodeKey: "class-10-mathematics-exponential-logarithm",
      programKey: "merdeka",
    };

    expect(
      index.toContextualMaterialHref({
        context,
        href: "/id/materi/matematika/eksponen-dan-logaritma/konsep-eksponen",
        route,
      })
    ).toBe(
      "/id/materi/matematika/eksponen-dan-logaritma/konsep-eksponen?ctx=merdeka~class-10-mathematics-exponential-logarithm"
    );

    expect(
      index.toContextualMaterialHref({
        context,
        href: "/id/materi/fisika/vektor/konsep-vektor",
        route: staleRoute,
      })
    ).toBe("/id/materi/fisika/vektor/konsep-vektor");
  });

  it("keeps lookup results stable after callers release the source route array", () => {
    const routes = readStaticRoutes();
    const index = createPublicLearningIndex({ routes });
    const route = requireRoute(
      index.resolveRouteByPath("materi/fisika/vektor/konsep-vektor", "id")
    );

    routes.length = 0;

    expect(
      index.resolveRouteByPath("materi/fisika/vektor/konsep-vektor", "id")
    ).toBe(route);
  });
});
