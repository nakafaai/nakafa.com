import { ProjectedCurriculumNodeSchema } from "@repo/contents/_types/curriculum/projection";
import { defineCurriculum } from "@repo/contents/_types/curriculum/schema";
import { MATERIAL_CARD_DESCRIPTION_MAX_LENGTH } from "@repo/contents/_types/material/description";
import { listPublicContentRoutes } from "@repo/contents/_types/route/content";
import {
  compareCurriculumRouteOrder,
  createCurriculumNodeMap,
  createDescendantMaterialMap,
  getCurriculumNodeMapKey,
  isRenderableCurriculumRoute,
  listPublicCurriculumRoutes,
  readCurriculumAncestors,
  readCurriculumRouteByPublicPath,
} from "@repo/contents/_types/route/curriculum";
import {
  readCurriculumCardListContext,
  readCurriculumMaterialCards,
} from "@repo/contents/_types/route/curriculum/card";
import { readStaticPublicCurriculumRoutes } from "@repo/contents/_types/route/curriculum/static";
import { makePath } from "@repo/contents/_types/route/path";
import { Effect, Exit, Schema } from "effect";
import { describe, expect, it } from "vitest";

const INDONESIAN_BIOLOGY_MATERIAL_HREF_PATTERN = /^\/id\/materi\/biologi\//;
const ROUTE_SHAPED_CURRICULUM_PATH_PATTERN = /^curriculum\/[^/]+\/\d/;

describe("public curriculum routes", () => {
  it("keeps static route helper rows identical to the validated default projection", () => {
    expect(readStaticPublicCurriculumRoutes()).toEqual(
      Effect.runSync(listPublicCurriculumRoutes())
    );
  });

  it("derives Merdeka context routes from curriculum mappings, not grade folders", () => {
    const routes = Effect.runSync(listPublicCurriculumRoutes());

    expect(routes).toContainEqual(
      expect.objectContaining({
        canonicalPath: "materi/matematika/integral",
        kind: "curriculum-context",
        locale: "id",
        materialDomain: "mathematics",
        materialKey: "lesson.mathematics.integral",
        programKey: "merdeka",
        publicPath: "kurikulum/merdeka/kelas-12/matematika/integral/integral",
      })
    );
    expect(routes).toContainEqual(
      expect.objectContaining({
        canonicalPath: "subjects/mathematics/integral",
        kind: "curriculum-context",
        locale: "en",
        materialKey: "lesson.mathematics.integral",
        programKey: "merdeka",
        publicPath: "curriculum/merdeka/class-12/mathematics/integral/integral",
      })
    );
    expect(
      routes.some((route) =>
        ROUTE_SHAPED_CURRICULUM_PATH_PATTERN.test(route.publicPath)
      )
    ).toBe(false);
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
      programKey: "merdeka",
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
            en: {
              routeSlug: "parent",
              title: "Parent",
            },
            id: {
              routeSlug: "induk",
              title: "Induk",
            },
          },
        },
      ],
    });
    const orphanNode = Schema.decodeUnknownSync(ProjectedCurriculumNodeSchema)({
      curriculumKey: "merdeka",
      key: "child",
      level: "topic",
      materialKeys: ["lesson.mathematics.integral"],
      order: 1,
      parentKey: "missing-parent",
      translations: {
        en: {
          routeSlug: "child",
          title: "Child",
        },
        id: {
          routeSlug: "anak",
          title: "Anak",
        },
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
      programKey: "merdeka",
      tree: [],
    });
    const childNode = Schema.decodeUnknownSync(ProjectedCurriculumNodeSchema)({
      curriculumKey: "merdeka",
      key: "child-first",
      level: "topic",
      materialKeys: ["lesson.mathematics.integral"],
      order: 1,
      parentKey: "parent-second",
      translations: {
        en: {
          routeSlug: "child-first",
          title: "Child first",
        },
        id: {
          routeSlug: "anak-dulu",
          title: "Anak dulu",
        },
      },
    });
    const parentNode = Schema.decodeUnknownSync(ProjectedCurriculumNodeSchema)({
      curriculumKey: "merdeka",
      key: "parent-second",
      level: "subject",
      materialKeys: [],
      order: 1,
      translations: {
        en: {
          routeSlug: "parent-second",
          title: "Parent second",
        },
        id: {
          routeSlug: "induk-kedua",
          title: "Induk kedua",
        },
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

  it("derives Cambridge context routes without making IGCSE the curriculum root", () => {
    const routes = Effect.runSync(listPublicCurriculumRoutes());

    expect(routes).toContainEqual(
      expect.objectContaining({
        canonicalPath: "subjects/mathematics/linear-equation-inequality",
        kind: "curriculum-context",
        locale: "en",
        materialDomain: "mathematics",
        materialKey: "lesson.mathematics.linear-equation-inequality",
        programKey: "cambridge-international",
        publicPath:
          "curriculum/cambridge-international/upper-secondary/mathematics-0580/algebra-and-graphs/linear-equation-inequality",
      })
    );
    expect(routes).toContainEqual(
      expect.objectContaining({
        canonicalPath:
          "materi/matematika/sistem-persamaan-dan-pertidaksamaan-linear",
        kind: "curriculum-context",
        locale: "id",
        materialKey: "lesson.mathematics.linear-equation-inequality",
        programKey: "cambridge-international",
        publicPath:
          "kurikulum/cambridge-international/upper-secondary/mathematics-0580/aljabar-dan-grafik/sistem-persamaan-dan-pertidaksamaan-linear",
      })
    );

    const stage = routes.find(
      (route) =>
        route.locale === "id" &&
        route.publicPath === "kurikulum/cambridge-international/upper-secondary"
    );
    const qualification = routes.find(
      (route) =>
        route.locale === "id" &&
        route.publicPath ===
          "kurikulum/cambridge-international/upper-secondary/igcse"
    );
    const course = routes.find(
      (route) =>
        route.locale === "id" &&
        route.publicPath ===
          "kurikulum/cambridge-international/upper-secondary/mathematics-0580"
    );
    expect(stage?.level).toBe("stage");
    expect(qualification).toBeUndefined();
    expect(course).toMatchObject({
      level: "course",
      parentPath: "kurikulum/cambridge-international/upper-secondary",
    });
    expect(
      routes.some((route) =>
        route.publicPath.includes("/upper-secondary/igcse")
      )
    ).toBe(false);
  });

  it("keeps curriculum navigation order source-owned", () => {
    const routes = Effect.runSync(listPublicCurriculumRoutes());
    const algebraLessons = routes
      .filter(
        (route) =>
          route.locale === "id" &&
          route.parentPath ===
            "kurikulum/cambridge-international/upper-secondary/mathematics-0580/aljabar-dan-grafik" &&
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

  it("does not project curriculum display descriptions", () => {
    const routes = Effect.runSync(listPublicCurriculumRoutes());
    const describedRoutes = routes
      .filter(isRenderableCurriculumRoute)
      .filter((route) => Object.hasOwn(route, "description"))
      .map((route) => `${route.locale}:${route.publicPath}`);

    expect(describedRoutes).toEqual([]);
  });

  it("projects source-owned group icons separately from card icons", () => {
    const routes = Effect.runSync(listPublicCurriculumRoutes());

    expect(routes).toContainEqual(
      expect.objectContaining({
        displayGroupIconKey: "primary-school",
        displayGroupTitle: "SD",
        iconKey: "grade-1",
        locale: "id",
        publicPath: "kurikulum/merdeka/kelas-1",
      })
    );
    expect(routes).toContainEqual(
      expect.objectContaining({
        displayGroupIconKey: "high-school",
        displayGroupTitle: "SMA",
        iconKey: "grade-10",
        locale: "id",
        publicPath: "kurikulum/merdeka/kelas-10",
      })
    );
    expect(routes).toContainEqual(
      expect.objectContaining({
        displayGroupIconKey: "school",
        displayGroupTitle: "Learning stages",
        iconKey: "high-school",
        locale: "en",
        publicPath: "curriculum/cambridge-international/upper-secondary",
      })
    );
    expect(routes).toContainEqual(
      expect.objectContaining({
        displayGroupIconKey: "school",
        displayGroupTitle: "Tahap sekolah",
        iconKey: "primary-school",
        locale: "id",
        publicPath: "kurikulum/singapore-moe/primary",
      })
    );
    expect(routes).toContainEqual(
      expect.objectContaining({
        displayGroupIconKey: "school",
        displayGroupTitle: "Tahap sekolah",
        iconKey: "high-school",
        locale: "id",
        publicPath: "kurikulum/amerika-serikat/sma",
      })
    );

    const rootPaths = [
      "kurikulum/merdeka",
      "kurikulum/cambridge-international",
      "kurikulum/singapore-moe",
      "kurikulum/amerika-serikat",
    ];

    for (const rootPath of rootPaths) {
      const root = routes.find(
        (route) => route.locale === "id" && route.publicPath === rootPath
      );

      expect(root).toBeDefined();

      if (!root) {
        continue;
      }

      const children = routes
        .filter(
          (route) =>
            route.locale === root.locale && route.parentPath === root.publicPath
        )
        .sort(compareCurriculumRouteOrder);
      const groupedChildren = new Map<string, Set<string>>();

      for (const child of children) {
        expect(child.displayGroupTitle).not.toBe(root.title);
        expect(child.displayGroupIconKey).not.toBe(root.iconKey);

        const groupKey = child.displayGroupTitle ?? "curriculum";
        const iconKeys = groupedChildren.get(groupKey) ?? new Set<string>();
        expect(iconKeys.has(child.iconKey ?? "")).toBe(false);
        iconKeys.add(child.iconKey ?? "");
        groupedChildren.set(groupKey, iconKeys);
      }
    }
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
    const unitRoute = routes.find(
      (route) =>
        route.locale === "id" &&
        route.parentPath === subjectRoute?.publicPath &&
        route.level === "unit"
    );
    const materialLeafRoute = routes.find(
      (route) =>
        route.locale === "id" &&
        route.parentPath === unitRoute?.publicPath &&
        route.materialKey !== undefined
    );
    const courseRoute = routes.find(
      (route) =>
        route.locale === "id" &&
        route.publicPath ===
          "kurikulum/cambridge-international/upper-secondary/mathematics-0580"
    );

    expect(root).toBeDefined();
    expect(classRoute).toBeDefined();
    expect(subjectRoute).toBeDefined();
    expect(unitRoute).toBeDefined();
    expect(materialLeafRoute).toBeDefined();
    expect(courseRoute).toBeDefined();

    if (
      !(
        root &&
        classRoute &&
        subjectRoute &&
        unitRoute &&
        materialLeafRoute &&
        courseRoute
      )
    ) {
      return;
    }

    expect(isRenderableCurriculumRoute(root)).toBe(true);
    expect(isRenderableCurriculumRoute(classRoute)).toBe(true);
    expect(isRenderableCurriculumRoute(subjectRoute)).toBe(true);
    expect(isRenderableCurriculumRoute(courseRoute)).toBe(true);
    expect(isRenderableCurriculumRoute(unitRoute)).toBe(false);
    expect(isRenderableCurriculumRoute(materialLeafRoute)).toBe(false);
    expect(unitRoute.sitemap).toBe(false);
    expect(materialLeafRoute.sitemap).toBe(false);
    expect(unitRoute.materialCardTitle).toBeTruthy();
    expect(unitRoute.materialCardDescription).toBeTruthy();
    expect(unitRoute.materialKey).toBeUndefined();
    expect(materialLeafRoute.materialCardTitle).toBeUndefined();
    expect(materialLeafRoute.materialCardDescription).toBeUndefined();
    expect(materialLeafRoute.materialKey).toBeDefined();
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
    expect(readCurriculumCardListContext(materialLeafRoute, routes)).toBe(
      subjectRoute
    );
    expect(readCurriculumCardListContext(root, routes)).toBeUndefined();
    expect(
      compareCurriculumRouteOrder(unitRoute, subjectRoute)
    ).toBeGreaterThan(0);
    const orphanMaterialLeafRoute = {
      ...materialLeafRoute,
      parentPath: Effect.runSync(makePath(["kurikulum", "merdeka", "missing"])),
    };

    expect(readCurriculumAncestors(orphanMaterialLeafRoute, routes)).toEqual(
      []
    );
    expect(
      readCurriculumCardListContext(orphanMaterialLeafRoute, routes)
    ).toBeUndefined();

    const cards = readCurriculumMaterialCards({
      contentRoutes,
      curriculumRoutes: routes,
      route: subjectRoute,
    });

    expect(cards.length).toBeGreaterThan(0);
    expect(cards[0]?.items.length).toBeGreaterThan(0);
    expect(cards[0]?.items[0]?.href).toMatch(
      INDONESIAN_BIOLOGY_MATERIAL_HREF_PATTERN
    );
    expect(cards[0]?.description).toBeTruthy();
    expect(cards[0]?.description?.length).toBeLessThanOrEqual(
      MATERIAL_CARD_DESCRIPTION_MAX_LENGTH
    );
    expect(
      readCurriculumMaterialCards({
        contentRoutes,
        curriculumRoutes: routes,
        route: classRoute,
      })
    ).toEqual([]);
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
        route.locale === materialLeafRoute.locale &&
        route.parentPath === materialLeafRoute.canonicalPath
    );

    expect(concreteLesson).toBeDefined();

    if (!concreteLesson) {
      return;
    }

    const concreteLessonCards = readCurriculumMaterialCards({
      contentRoutes,
      curriculumRoutes: [
        subjectRoute,
        unitRoute,
        { ...materialLeafRoute, canonicalPath: concreteLesson.publicPath },
      ],
      route: subjectRoute,
    });

    expect(concreteLessonCards).toHaveLength(1);
    expect(concreteLessonCards[0]).toMatchObject({
      href: `/${concreteLesson.locale}/${concreteLesson.publicPath}`,
      items: [
        {
          href: `/${concreteLesson.locale}/${concreteLesson.publicPath}`,
          title: concreteLesson.title,
        },
      ],
      title: unitRoute.materialCardTitle,
    });
    expect(concreteLessonCards[0]?.description).toBeTruthy();
    expect(concreteLessonCards[0]?.description?.length).toBeLessThanOrEqual(
      MATERIAL_CARD_DESCRIPTION_MAX_LENGTH
    );
  });

  it("requires concise curriculum-owned display copy for every rendered curriculum material card", () => {
    const curriculumRoutes = Effect.runSync(listPublicCurriculumRoutes());
    const contentRoutes = Effect.runSync(listPublicContentRoutes());
    const programKeysWithCards = new Set<string>();

    for (const route of curriculumRoutes) {
      const cards = readCurriculumMaterialCards({
        contentRoutes,
        curriculumRoutes,
        route,
      });

      if (cards.length === 0) {
        continue;
      }

      programKeysWithCards.add(route.programKey);

      for (const card of cards) {
        const sourceRoute = curriculumRoutes.find(
          (candidate) =>
            candidate.locale === route.locale &&
            candidate.parentPath === route.publicPath &&
            candidate.materialCardTitle === card.title
        );

        expect(sourceRoute?.level).toBe("unit");
        expect(sourceRoute?.materialKey).toBeUndefined();
        expect(sourceRoute?.materialCardDescription).toBe(card.description);
        expect(sourceRoute?.materialCardTitle).toBe(card.title);
        expect(
          curriculumRoutes.some(
            (candidate) =>
              candidate.locale === route.locale &&
              candidate.parentPath === sourceRoute?.publicPath &&
              candidate.materialKey !== undefined
          )
        ).toBe(true);
        expect(card.description.trim()).toBe(card.description);
        expect(card.description.length).toBeGreaterThan(0);
        expect(card.description.length).toBeLessThanOrEqual(
          MATERIAL_CARD_DESCRIPTION_MAX_LENGTH
        );
      }
    }

    expect(programKeysWithCards).toEqual(
      new Set([
        "cambridge-international",
        "merdeka",
        "singapore-moe",
        "united-states",
      ])
    );
  });

  it("keeps concrete material leaves out of curriculum card ownership", () => {
    const curriculumRoutes = Effect.runSync(listPublicCurriculumRoutes());

    for (const route of curriculumRoutes) {
      if (route.materialKey === undefined) {
        continue;
      }

      expect(route.materialCardDescription).toBeUndefined();
      expect(route.materialCardTitle).toBeUndefined();
      expect(isRenderableCurriculumRoute(route)).toBe(false);
      expect(route.sitemap).toBe(false);
    }
  });

  it("indexes projected curriculum descendants by source-owned node keys", () => {
    const childNode = Schema.decodeUnknownSync(ProjectedCurriculumNodeSchema)({
      curriculumKey: "merdeka",
      key: "child-first",
      level: "topic",
      materialKeys: ["lesson.mathematics.integral"],
      order: 1,
      parentKey: "parent-second",
      translations: {
        en: {
          routeSlug: "child-first",
          title: "Child first",
        },
        id: {
          routeSlug: "anak-dulu",
          title: "Anak dulu",
        },
      },
    });
    const parentNode = Schema.decodeUnknownSync(ProjectedCurriculumNodeSchema)({
      curriculumKey: "merdeka",
      key: "parent-second",
      level: "subject",
      materialKeys: [],
      order: 1,
      translations: {
        en: {
          routeSlug: "parent-second",
          title: "Parent second",
        },
        id: {
          routeSlug: "induk-kedua",
          title: "Induk kedua",
        },
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

  it("keeps only ready mapped curriculum rows renderable", () => {
    const routes = Effect.runSync(listPublicCurriculumRoutes());
    const singaporeRoot = routes.find(
      (route) =>
        route.locale === "id" && route.publicPath === "kurikulum/singapore-moe"
    );
    const singaporePrimary = routes.find(
      (route) =>
        route.locale === "id" &&
        route.publicPath === "kurikulum/singapore-moe/primary"
    );
    const unitedStatesRoot = routes.find(
      (route) =>
        route.locale === "id" &&
        route.publicPath === "kurikulum/amerika-serikat"
    );
    const singaporeSecondary = routes.find(
      (route) =>
        route.locale === "en" &&
        route.publicPath === "curriculum/singapore-moe/secondary"
    );
    const singaporeMathematics = routes.find(
      (route) =>
        route.locale === "en" &&
        route.publicPath === "curriculum/singapore-moe/secondary/mathematics"
    );
    const unitedStatesHighSchool = routes.find(
      (route) =>
        route.locale === "en" &&
        route.publicPath === "curriculum/united-states/high-school"
    );
    const unitedStatesMathematics = routes.find(
      (route) =>
        route.locale === "en" &&
        route.publicPath === "curriculum/united-states/high-school/mathematics"
    );

    expect(singaporeRoot).toMatchObject({
      level: "track",
      programKey: "singapore-moe",
      sitemap: true,
    });
    expect(singaporeRoot?.materialKey).toBeUndefined();
    expect(singaporeRoot && isRenderableCurriculumRoute(singaporeRoot)).toBe(
      true
    );
    expect(singaporePrimary).toMatchObject({
      level: "stage",
      programKey: "singapore-moe",
      sitemap: false,
    });
    expect(singaporePrimary?.materialKey).toBeUndefined();
    expect(
      singaporePrimary && isRenderableCurriculumRoute(singaporePrimary)
    ).toBe(false);
    expect(unitedStatesRoot).toMatchObject({
      level: "track",
      programKey: "united-states",
      sitemap: true,
    });
    expect(unitedStatesRoot?.materialKey).toBeUndefined();
    expect(
      unitedStatesRoot && isRenderableCurriculumRoute(unitedStatesRoot)
    ).toBe(true);
    expect(
      singaporeSecondary && isRenderableCurriculumRoute(singaporeSecondary)
    ).toBe(true);
    expect(
      singaporeMathematics && isRenderableCurriculumRoute(singaporeMathematics)
    ).toBe(true);
    expect(
      unitedStatesHighSchool &&
        isRenderableCurriculumRoute(unitedStatesHighSchool)
    ).toBe(true);
    expect(
      unitedStatesMathematics &&
        isRenderableCurriculumRoute(unitedStatesMathematics)
    ).toBe(true);
    expect(
      [...new Set(routes.map((route) => route.programKey))].sort()
    ).toEqual([
      "cambridge-international",
      "merdeka",
      "singapore-moe",
      "united-states",
    ]);
  });

  it("fails with typed errors when curriculum mapping references unknown material", () => {
    const invalidCurriculum = defineCurriculum({
      programKey: "merdeka",
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
