import { ProjectedCurriculumNodeSchema } from "@repo/contents/_types/curriculum/projection";
import { defineCurriculum } from "@repo/contents/_types/curriculum/schema";
import { listPublicContentRoutes } from "@repo/contents/_types/route/content";
import {
  compareCurriculumRouteOrder,
  createCurriculumNodeMap,
  createDescendantMaterialMap,
  getCurriculumNodeMapKey,
  isRenderableCurriculumRoute,
  listPublicCurriculumRoutes,
  readCurriculumAncestors,
  readCurriculumCardListContext,
  readCurriculumMaterialCards,
  readCurriculumRouteByPublicPath,
} from "@repo/contents/_types/route/curriculum";
import { makePath } from "@repo/contents/_types/route/path";
import { Effect, Exit, Schema } from "effect";
import { describe, expect, it } from "vitest";

const INDONESIAN_BIOLOGY_MATERIAL_HREF_PATTERN = /^\/id\/materi\/biologi\//;

describe("public curriculum routes", () => {
  it("derives Merdeka context routes from curriculum mappings, not grade folders", () => {
    const routes = Effect.runSync(listPublicCurriculumRoutes());

    expect(routes).toContainEqual(
      expect.objectContaining({
        canonicalPath: "materi/matematika/integral",
        kind: "curriculum-context",
        locale: "id",
        materialDomain: "mathematics",
        materialKey: "lesson.mathematics.integral",
        programKey: "id-kurikulum-merdeka",
        publicPath: "kurikulum/merdeka/kelas-12/matematika/integral",
      })
    );
    expect(routes).toContainEqual(
      expect.objectContaining({
        canonicalPath: "subjects/mathematics/integral",
        kind: "curriculum-context",
        locale: "en",
        materialKey: "lesson.mathematics.integral",
        programKey: "id-kurikulum-merdeka",
        publicPath: "curriculum/merdeka/class-12/mathematics/integral",
      })
    );
    expect(
      routes.every((route) => !route.publicPath.includes("high-school"))
    ).toBe(true);
    expect(routes).toContainEqual(
      expect.objectContaining({
        kind: "curriculum-context",
        locale: "id",
        materialDomain: "physics",
        nodeKey: "class-10-physics",
        publicPath: "kurikulum/merdeka/kelas-10/fisika",
      })
    );
  });

  it("projects curriculum nodes from their material slug when a parent is absent", () => {
    const curriculum = defineCurriculum({
      programKey: "id-kurikulum-merdeka",
      tree: [
        {
          children: [
            {
              key: "child",
              level: "topic",
              materialKeys: ["lesson.mathematics.integral"],
              order: 1,
            },
          ],
          key: "parent",
          level: "subject",
          order: 1,
          translations: {
            en: { routeSlug: "parent", title: "Parent" },
            id: { routeSlug: "induk", title: "Induk" },
          },
        },
      ],
    });
    const orphanNode = Schema.decodeUnknownSync(ProjectedCurriculumNodeSchema)({
      curriculumKey: "id-kurikulum-merdeka",
      key: "child",
      level: "topic",
      materialKeys: ["lesson.mathematics.integral"],
      order: 1,
      parentKey: "missing-parent",
      translations: {
        en: { routeSlug: "child", title: "Child" },
        id: { routeSlug: "anak", title: "Anak" },
      },
    });
    const routes = Effect.runSync(
      listPublicCurriculumRoutes({
        curricula: [curriculum],
        curriculumNodes: [orphanNode],
      })
    );

    expect(routes).toContainEqual(
      expect.objectContaining({
        nodeKey: "child",
        publicPath: "kurikulum/merdeka/integral",
      })
    );
  });

  it("projects descendant curriculum material when children are decoded first", () => {
    const curriculum = defineCurriculum({
      programKey: "id-kurikulum-merdeka",
      tree: [],
    });
    const childNode = Schema.decodeUnknownSync(ProjectedCurriculumNodeSchema)({
      curriculumKey: "id-kurikulum-merdeka",
      key: "child-first",
      level: "topic",
      materialKeys: ["lesson.mathematics.integral"],
      order: 1,
      parentKey: "parent-second",
      translations: {
        en: { routeSlug: "child-first", title: "Child first" },
        id: { routeSlug: "anak-dulu", title: "Anak dulu" },
      },
    });
    const parentNode = Schema.decodeUnknownSync(ProjectedCurriculumNodeSchema)({
      curriculumKey: "id-kurikulum-merdeka",
      key: "parent-second",
      level: "subject",
      materialKeys: [],
      order: 1,
      translations: {
        en: { routeSlug: "parent-second", title: "Parent second" },
        id: { routeSlug: "induk-kedua", title: "Induk kedua" },
      },
    });
    const routes = Effect.runSync(
      listPublicCurriculumRoutes({
        curricula: [curriculum],
        curriculumNodes: [childNode, parentNode],
      })
    );

    expect(routes).toContainEqual(
      expect.objectContaining({
        nodeKey: "parent-second",
        publicPath: "kurikulum/merdeka/induk-kedua",
      })
    );
  });

  it("derives Cambridge context routes and scope-true descriptions", () => {
    const routes = Effect.runSync(listPublicCurriculumRoutes());

    expect(routes).toContainEqual(
      expect.objectContaining({
        canonicalPath: "subjects/mathematics/linear-equation-inequality",
        kind: "curriculum-context",
        locale: "en",
        materialDomain: "mathematics",
        materialKey: "lesson.mathematics.linear-equation-inequality",
        programKey: "cambridge-igcse",
        publicPath:
          "curriculum/cambridge-igcse/mathematics-0580/algebra-and-graphs/linear-equation-inequality",
      })
    );
    expect(routes).toContainEqual(
      expect.objectContaining({
        canonicalPath:
          "materi/matematika/sistem-persamaan-dan-pertidaksamaan-linear",
        kind: "curriculum-context",
        locale: "id",
        materialKey: "lesson.mathematics.linear-equation-inequality",
        programKey: "cambridge-igcse",
        publicPath:
          "kurikulum/cambridge-igcse/mathematics-0580/aljabar-dan-grafik/sistem-persamaan-dan-pertidaksamaan-linear",
      })
    );

    const root = routes.find(
      (route) =>
        route.locale === "id" &&
        route.publicPath === "kurikulum/cambridge-igcse"
    );
    const course = routes.find(
      (route) =>
        route.locale === "id" &&
        route.publicPath === "kurikulum/cambridge-igcse/mathematics-0580"
    );
    const unit = routes.find(
      (route) =>
        route.locale === "id" &&
        route.publicPath ===
          "kurikulum/cambridge-igcse/mathematics-0580/aljabar-dan-grafik"
    );

    expect(root?.description).toBeUndefined();
    expect(course?.description).toBeUndefined();
    expect(unit?.description).toBe(
      "Pelajari persamaan, barisan, fungsi, dan grafik sebagai alat aljabar yang saling terhubung."
    );
  });

  it("keeps curriculum navigation order source-owned", () => {
    const routes = Effect.runSync(listPublicCurriculumRoutes());
    const algebraLessons = routes
      .filter(
        (route) =>
          route.locale === "id" &&
          route.parentPath ===
            "kurikulum/cambridge-igcse/mathematics-0580/aljabar-dan-grafik" &&
          route.materialKey !== undefined
      )
      .sort((left, right) => left.order - right.order)
      .map((route) => [route.materialKey, route.order]);

    expect(algebraLessons).toEqual([
      ["lesson.mathematics.linear-equation-inequality", 10],
      ["lesson.mathematics.quadratic-function", 20],
      ["lesson.mathematics.sequence-series", 30],
      ["lesson.mathematics.function-modeling", 40],
    ]);
  });

  it("exposes curriculum context helpers for app card-list composition", () => {
    const contentRoutes = Effect.runSync(listPublicContentRoutes());
    const routes = Effect.runSync(listPublicCurriculumRoutes());
    const root = routes.find(
      (route) =>
        route.locale === "id" && route.publicPath === "kurikulum/merdeka"
    );
    const classRoute = routes.find(
      (route) =>
        route.locale === "id" &&
        route.publicPath === "kurikulum/merdeka/kelas-10"
    );
    const subjectRoute = routes.find(
      (route) =>
        route.locale === "id" &&
        route.publicPath === "kurikulum/merdeka/kelas-10/biologi"
    );
    const topicRoute = routes.find(
      (route) =>
        route.locale === "id" &&
        route.parentPath === subjectRoute?.publicPath &&
        route.level === "topic"
    );
    const courseRoute = routes.find(
      (route) =>
        route.locale === "id" &&
        route.publicPath === "kurikulum/cambridge-igcse/mathematics-0580"
    );

    expect(root).toBeDefined();
    expect(classRoute).toBeDefined();
    expect(subjectRoute).toBeDefined();
    expect(topicRoute).toBeDefined();
    expect(courseRoute).toBeDefined();

    if (!(root && classRoute && subjectRoute && topicRoute && courseRoute)) {
      return;
    }

    expect(isRenderableCurriculumRoute(root)).toBe(true);
    expect(isRenderableCurriculumRoute(classRoute)).toBe(true);
    expect(isRenderableCurriculumRoute(subjectRoute)).toBe(true);
    expect(isRenderableCurriculumRoute(courseRoute)).toBe(true);
    expect(isRenderableCurriculumRoute(topicRoute)).toBe(false);
    expect(topicRoute.sitemap).toBe(false);
    expect(
      readCurriculumRouteByPublicPath(
        routes,
        subjectRoute.locale,
        subjectRoute.publicPath
      )
    ).toBe(subjectRoute);
    expect(
      readCurriculumAncestors(subjectRoute, routes).map((route) => route.title)
    ).toEqual(["Kurikulum Merdeka", "Kelas 10"]);
    expect(readCurriculumAncestors(root, routes)).toEqual([]);
    expect(readCurriculumCardListContext(topicRoute, routes)).toBe(
      subjectRoute
    );
    expect(readCurriculumCardListContext(root, routes)).toBeUndefined();
    expect(
      compareCurriculumRouteOrder(topicRoute, subjectRoute)
    ).toBeGreaterThan(0);
    const orphanTopicRoute = {
      ...topicRoute,
      parentPath: Effect.runSync(makePath(["kurikulum", "merdeka", "missing"])),
    };

    expect(readCurriculumAncestors(orphanTopicRoute, routes)).toEqual([]);
    expect(
      readCurriculumCardListContext(orphanTopicRoute, routes)
    ).toBeUndefined();

    const cards = readCurriculumMaterialCards({
      contentRoutes,
      curriculumRoutes: routes,
      route: subjectRoute,
    });

    expect(cards.length).toBeGreaterThan(0);
    expect(cards[0]?.description).toBeTruthy();
    expect(cards[0]?.items.length).toBeGreaterThan(0);
    expect(cards[0]?.items[0]?.href).toMatch(
      INDONESIAN_BIOLOGY_MATERIAL_HREF_PATTERN
    );
    expect(
      readCurriculumMaterialCards({
        contentRoutes,
        curriculumRoutes: routes,
        route: classRoute,
      }).length
    ).toBeGreaterThan(0);
    expect(
      readCurriculumMaterialCards({
        contentRoutes: [],
        curriculumRoutes: routes,
        route: subjectRoute,
      })
    ).toEqual([]);

    const concreteLesson = contentRoutes.find(
      (route) =>
        route.kind === "subject-lesson" &&
        route.locale === topicRoute.locale &&
        route.parentPath === topicRoute.canonicalPath
    );

    expect(concreteLesson).toBeDefined();

    if (!concreteLesson) {
      return;
    }

    expect(
      readCurriculumMaterialCards({
        contentRoutes,
        curriculumRoutes: [
          subjectRoute,
          { ...topicRoute, canonicalPath: concreteLesson.publicPath },
        ],
        route: subjectRoute,
      })
    ).toEqual([
      {
        description: topicRoute.description,
        href: `/${concreteLesson.locale}/${concreteLesson.publicPath}`,
        items: [
          {
            href: `/${concreteLesson.locale}/${concreteLesson.publicPath}`,
            title: concreteLesson.title,
          },
        ],
        title: topicRoute.title,
      },
    ]);
  });

  it("indexes projected curriculum descendants by source-owned node keys", () => {
    const childNode = Schema.decodeUnknownSync(ProjectedCurriculumNodeSchema)({
      curriculumKey: "id-kurikulum-merdeka",
      key: "child-first",
      level: "topic",
      materialKeys: ["lesson.mathematics.integral"],
      order: 1,
      parentKey: "parent-second",
      translations: {
        en: { routeSlug: "child-first", title: "Child first" },
        id: { routeSlug: "anak-dulu", title: "Anak dulu" },
      },
    });
    const parentNode = Schema.decodeUnknownSync(ProjectedCurriculumNodeSchema)({
      curriculumKey: "id-kurikulum-merdeka",
      key: "parent-second",
      level: "subject",
      materialKeys: [],
      order: 1,
      translations: {
        en: { routeSlug: "parent-second", title: "Parent second" },
        id: { routeSlug: "induk-kedua", title: "Induk kedua" },
      },
    });
    const nodeByKey = createCurriculumNodeMap([childNode, parentNode]);
    const descendantMaterials = createDescendantMaterialMap([
      childNode,
      parentNode,
    ]);

    expect(nodeByKey.get(getCurriculumNodeMapKey(parentNode))).toBe(parentNode);
    expect(
      descendantMaterials
        .get(getCurriculumNodeMapKey(parentNode))
        ?.has("lesson.mathematics.integral")
    ).toBe(true);
  });

  it("does not invent public routes for planned curricula without material mappings", () => {
    expect(
      Effect.runSync(listPublicCurriculumRoutes()).some(
        (route) => route.programKey === "us-common-core-ngss"
      )
    ).toBe(false);
  });

  it("fails with typed errors when curriculum mapping references unknown material", () => {
    const invalidCurriculum = defineCurriculum({
      programKey: "id-kurikulum-merdeka",
      tree: [
        {
          key: "missing-material",
          level: "topic",
          materialKeys: ["lesson.fixture.missing"],
          order: 1,
        },
      ],
    });
    const exit = Effect.runSyncExit(
      listPublicCurriculumRoutes({
        curricula: [invalidCurriculum],
        materials: [],
      })
    );

    expect(Exit.isFailure(exit)).toBe(true);
  });
});
