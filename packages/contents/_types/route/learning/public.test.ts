import { isMaterialLessonRoute } from "@repo/contents/_types/route/content";
import { readStaticPublicContentRoutes } from "@repo/contents/_types/route/content/static";
import { readStaticPublicCurriculumRoutes } from "@repo/contents/_types/route/curriculum/static";
import { createPublicLearningIndex } from "@repo/contents/_types/route/learning/public";
import type {
  PublicContentRoute,
  PublicRoute,
} from "@repo/contents/_types/route/schema";
import { PublicContentRouteSchema } from "@repo/contents/_types/route/schema";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

type MaterialLessonRoute = Extract<
  PublicContentRoute,
  { readonly kind: "subject-lesson" }
>;

/** Builds the production-shaped static route rows used by index tests. */
function readStaticRoutes() {
  return [
    ...readStaticPublicContentRoutes(),
    ...readStaticPublicCurriculumRoutes(),
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
  if (
    !(
      route &&
      route.kind !== "curriculum-context" &&
      isMaterialLessonRoute(route)
    )
  ) {
    throw new Error("Expected production material lesson route fixture");
  }

  return route;
}

describe("createPublicLearningIndex", () => {
  it("resolves exact routes and virtual practice questions by keyed path lookup", () => {
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
        "latihan/snbt/pengetahuan-kuantitatif/tryout-2026/set-1/soal-1",
        "id"
      )
    ).toMatchObject({
      kind: "exercise-question",
      sourcePath:
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1/1",
    });

    const idQuestionRoute = requireRoute(
      index.resolveRouteByPath(
        "latihan/snbt/pengetahuan-kuantitatif/tryout-2026/set-1/soal-1",
        "id"
      )
    );

    expect(index.projectRouteToLocale(idQuestionRoute, "en")).toMatchObject({
      publicPath:
        "practice/snbt/quantitative-knowledge/tryout-2026/set-1/question-1",
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

  it("projects virtual practice root and domain paths without exposing segment grammar", () => {
    const index = createPublicLearningIndex({ routes: readStaticRoutes() });

    expect(
      index.projectPracticeRootPath({
        currentLocale: "id",
        path: "latihan/snbt",
        targetLocale: "en",
      })
    ).toBe("practice/snbt");

    expect(
      index.projectPracticeDomainPath({
        currentLocale: "id",
        path: "latihan/snbt/pengetahuan-kuantitatif",
        targetLocale: "en",
      })
    ).toBe("practice/snbt/quantitative-knowledge");
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

  it("ignores stale virtual practice source rows and unknown virtual paths", () => {
    const setRoute = requireRoute(
      readStaticRoutes().find(
        (route) =>
          route.kind === "exercise-set" &&
          route.publicPath ===
            "latihan/snbt/pengetahuan-kuantitatif/tryout-2026/set-1"
      )
    );
    const staleSetRoute = Schema.decodeUnknownSync(PublicContentRouteSchema)({
      ...setRoute,
      sourcePath: "material/practice/stale-source",
    });
    const index = createPublicLearningIndex({ routes: [staleSetRoute] });

    expect(
      index.projectPracticeRootPath({
        currentLocale: "id",
        path: "latihan/snbt",
        targetLocale: "en",
      })
    ).toBeUndefined();

    expect(
      createPublicLearningIndex({
        routes: readStaticRoutes(),
      }).projectPracticeDomainPath({
        currentLocale: "id",
        path: "latihan/snbt/unknown-domain",
        targetLocale: "en",
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
