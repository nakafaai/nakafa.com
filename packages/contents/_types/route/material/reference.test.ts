import { listPublicContentRoutes } from "@repo/contents/_types/route/content";
import { listPublicCurriculumRoutes } from "@repo/contents/_types/route/curriculum";
import {
  listMaterialContextRefs,
  readMaterialContextRef,
} from "@repo/contents/_types/route/material/reference";
import type { PublicCurriculumRoute } from "@repo/contents/_types/route/schema";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const LESSON_SOURCE_PATH =
  "material/lesson/mathematics/linear-equation-inequality/system-linear-equation";

describe("material context references", () => {
  it("indexes localized curriculum card contexts by lesson identity", () => {
    const contentRoutes = Effect.runSync(listPublicContentRoutes());
    const curriculumRoutes = Effect.runSync(listPublicCurriculumRoutes());
    const refs = listMaterialContextRefs({ contentRoutes, curriculumRoutes });
    const route = contentRoutes.find(
      (candidate) =>
        candidate.kind === "subject-lesson" &&
        candidate.locale === "id" &&
        candidate.sourcePath === LESSON_SOURCE_PATH
    );

    expect(route).toBeDefined();

    if (!route) {
      return;
    }

    const merdekaContext = {
      nodeKey: "class-10-mathematics-linear-equation-inequality",
      programKey: "merdeka",
    };
    const merdekaRef = readMaterialContextRef({
      contextRoute: merdekaContext,
      refs,
      route,
    });
    const unitedStatesRef = refs.find(
      (ref) =>
        ref.locale === "en" &&
        ref.sourcePath === route.sourcePath &&
        ref.programKey === "united-states" &&
        ref.nodeKey === "high-school-mathematics-algebra"
    );

    expect(merdekaRef).toMatchObject({
      parentHref:
        "/id/kurikulum/merdeka/kelas-10/matematika#persamaan-dan-pertidaksamaan-linear",
      parentTitle: "Persamaan dan Pertidaksamaan Linear",
    });
    expect(unitedStatesRef).toMatchObject({
      parentHref:
        "/en/curriculum/united-states/high-school/mathematics#algebra",
      parentTitle: "Algebra",
    });
    expect(
      readMaterialContextRef({
        contextRoute: { ...merdekaContext, nodeKey: "missing" },
        refs,
        route,
      })
    ).toBeUndefined();
  });

  it("ignores curriculum rows that cannot return to a material card list", () => {
    const contentRoutes = Effect.runSync(listPublicContentRoutes());
    const curriculumRoutes = Effect.runSync(listPublicCurriculumRoutes());
    const materialRoute = contentRoutes.find(
      (candidate) =>
        candidate.kind === "subject-lesson" &&
        candidate.locale === "id" &&
        candidate.sourcePath === LESSON_SOURCE_PATH
    );
    const route = curriculumRoutes.find(
      (candidate) =>
        candidate.locale === "id" &&
        candidate.nodeKey ===
          "class-10-mathematics-linear-equation-inequality-material"
    );

    expect(route).toBeDefined();
    expect(materialRoute).toBeDefined();

    if (!(route && materialRoute)) {
      return;
    }

    const unitRoute = curriculumRoutes.find(
      (candidate) =>
        candidate.locale === route.locale &&
        candidate.publicPath === route.parentPath
    );
    const subjectRoute = curriculumRoutes.find(
      (candidate) =>
        candidate.locale === unitRoute?.locale &&
        candidate.publicPath === unitRoute?.parentPath
    );

    expect(unitRoute).toBeDefined();
    expect(subjectRoute).toBeDefined();

    if (!(unitRoute && subjectRoute)) {
      return;
    }

    const detachedRoute: PublicCurriculumRoute = {
      ...route,
      parentPath: undefined,
    };
    const exactLessonRoute: PublicCurriculumRoute = {
      ...route,
      canonicalPath: materialRoute.publicPath,
    };

    expect(
      listMaterialContextRefs({
        contentRoutes,
        curriculumRoutes: [detachedRoute],
      })
    ).toEqual([]);
    expect(
      listMaterialContextRefs({
        contentRoutes,
        curriculumRoutes: [route],
      })
    ).toEqual([]);
    expect(
      listMaterialContextRefs({
        contentRoutes: [],
        curriculumRoutes,
      })
    ).toEqual([]);
    expect(
      listMaterialContextRefs({
        contentRoutes,
        curriculumRoutes: [subjectRoute, unitRoute, exactLessonRoute],
      }).some((ref) => ref.sourcePath === materialRoute.sourcePath)
    ).toBe(true);

    const unitWithoutCardTitle: PublicCurriculumRoute = {
      ...unitRoute,
      materialCardTitle: undefined,
    };
    const fallbackRef = listMaterialContextRefs({
      contentRoutes,
      curriculumRoutes: [subjectRoute, unitWithoutCardTitle, exactLessonRoute],
    }).find((ref) => ref.sourcePath === materialRoute.sourcePath);

    expect(fallbackRef).toMatchObject({ parentTitle: unitRoute.title });
  });
});
