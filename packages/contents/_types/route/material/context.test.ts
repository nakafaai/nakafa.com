import { listPublicContentRoutes } from "@repo/contents/_types/route/content";
import { listPublicCurriculumRoutes } from "@repo/contents/_types/route/curriculum";
import { addCurriculumMaterialContextOwnership } from "@repo/contents/_types/route/curriculum/context";
import {
  projectMaterialContextToLocale,
  readMaterialContextHint,
  resolveMaterialHeaderLink,
  toContextualMaterialHref,
} from "@repo/contents/_types/route/material/context";
import { listMaterialContextRefs } from "@repo/contents/_types/route/material/reference";
import type { PublicCurriculumRoute } from "@repo/contents/_types/route/schema";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("material route context", () => {
  it("builds contextual material hrefs from curriculum card identity", () => {
    const contentRoutes = Effect.runSync(listPublicContentRoutes());
    const curriculumRoutes = Effect.runSync(listPublicCurriculumRoutes());
    const refs = listMaterialContextRefs({ contentRoutes, curriculumRoutes });
    const placementRoute = curriculumRoutes.find(
      (candidate) =>
        candidate.locale === "id" &&
        candidate.nodeKey ===
          "class-10-mathematics-linear-equation-inequality-material"
    );
    const route = contentRoutes.find(
      (candidate) =>
        candidate.kind === "subject-lesson" &&
        candidate.locale === "id" &&
        candidate.sourcePath ===
          "material/lesson/mathematics/linear-equation-inequality/system-linear-equation"
    );

    expect(route).toBeDefined();
    expect(
      curriculumRoutes
        .filter((candidate) => candidate.materialKey)
        .every(
          (candidate) =>
            candidate.materialContextNodeKey &&
            candidate.materialContextParentPath &&
            candidate.materialContextPublicPath
        )
    ).toBe(true);
    expect(placementRoute).toMatchObject({
      materialContextNodeKey: "class-10-mathematics-linear-equation-inequality",
      materialContextParentPath: "kurikulum/merdeka/kelas-10/matematika",
      materialContextPublicPath:
        "kurikulum/merdeka/kelas-10/matematika/sistem-persamaan-dan-pertidaksamaan-linear",
    });

    if (!route) {
      return;
    }

    const merdekaRef = refs.find(
      (ref) =>
        ref.locale === route.locale &&
        ref.sourcePath === route.sourcePath &&
        ref.programKey === "merdeka" &&
        ref.nodeKey === "class-10-mathematics-linear-equation-inequality"
    );
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

    if (!merdekaRef) {
      return;
    }

    const contextHref = toContextualMaterialHref({
      href: `/${route.locale}/${route.publicPath}`,
      ref: merdekaRef,
    });

    expect(contextHref).toBe(
      "/id/materi/matematika/sistem-persamaan-dan-pertidaksamaan-linear/sistem-persamaan-linear?ctx=merdeka~class-10-mathematics-linear-equation-inequality"
    );
    expect(
      toContextualMaterialHref({
        href: `/${route.locale}/${route.publicPath}?preview=true`,
        ref: merdekaRef,
      })
    ).toBe(
      "/id/materi/matematika/sistem-persamaan-dan-pertidaksamaan-linear/sistem-persamaan-linear?preview=true&ctx=merdeka~class-10-mathematics-linear-equation-inequality"
    );
    expect(
      resolveMaterialHeaderLink({
        context: merdekaRef,
        refs,
        route,
      })
    ).toEqual({
      href: merdekaRef.parentHref,
      label: merdekaRef.parentTitle,
    });
  });

  it("ignores missing, malformed, or mismatched material context hints", () => {
    const contentRoutes = Effect.runSync(listPublicContentRoutes());
    const curriculumRoutes = Effect.runSync(listPublicCurriculumRoutes());
    const refs = listMaterialContextRefs({ contentRoutes, curriculumRoutes });
    const route = contentRoutes.find(
      (candidate) =>
        candidate.kind === "subject-lesson" &&
        candidate.locale === "id" &&
        candidate.sourcePath ===
          "material/lesson/mathematics/linear-equation-inequality/system-linear-equation"
    );

    expect(route).toBeDefined();

    if (!route) {
      return;
    }

    expect(readMaterialContextHint("merdeka~node")).toEqual({
      nodeKey: "node",
      programKey: "merdeka",
    });
    expect(readMaterialContextHint(["merdeka~node"])).toBeUndefined();
    expect(readMaterialContextHint("merdeka")).toBeUndefined();
    expect(readMaterialContextHint("~node")).toBeUndefined();
    expect(
      toContextualMaterialHref({
        href: `/${route.locale}/${route.publicPath}`,
        ref: undefined,
      })
    ).toBe(`/${route.locale}/${route.publicPath}`);
    expect(
      resolveMaterialHeaderLink({
        context: undefined,
        refs,
        route,
      })
    ).toBeUndefined();
    expect(
      resolveMaterialHeaderLink({
        context: {
          nodeKey: "class-10-biology-virus-role",
          programKey: "merdeka",
        },
        refs,
        route,
      })
    ).toBeUndefined();
  });

  it("projects valid context hints by source identity and drops missing targets", () => {
    const contentRoutes = Effect.runSync(listPublicContentRoutes());
    const curriculumRoutes = Effect.runSync(listPublicCurriculumRoutes());
    const refs = listMaterialContextRefs({ contentRoutes, curriculumRoutes });
    const currentRoute = contentRoutes.find(
      (candidate) =>
        candidate.kind === "subject-lesson" &&
        candidate.locale === "id" &&
        candidate.sourcePath ===
          "material/lesson/mathematics/linear-equation-inequality/system-linear-equation"
    );
    const targetRoute = contentRoutes.find(
      (candidate) =>
        candidate.kind === "subject-lesson" &&
        candidate.locale === "en" &&
        candidate.sourcePath ===
          "material/lesson/mathematics/linear-equation-inequality/system-linear-equation"
    );

    expect(currentRoute).toBeDefined();
    expect(targetRoute).toBeDefined();

    if (!(currentRoute && targetRoute)) {
      return;
    }

    const projected = projectMaterialContextToLocale({
      context: {
        nodeKey: "class-10-mathematics-linear-equation-inequality",
        programKey: "merdeka",
      },
      currentRoute,
      refs,
      targetRoute,
    });

    expect(projected).toEqual({
      nodeKey: "class-10-mathematics-linear-equation-inequality",
      programKey: "merdeka",
    });
    expect(
      projectMaterialContextToLocale({
        context: {
          nodeKey: "class-10-mathematics-linear-equation-inequality",
          programKey: "merdeka",
        },
        currentRoute,
        refs: refs.filter(
          (ref) =>
            !(
              ref.locale === "en" &&
              ref.programKey === "merdeka" &&
              ref.nodeKey === "class-10-mathematics-linear-equation-inequality"
            )
        ),
        targetRoute,
      })
    ).toBeUndefined();
    expect(
      projectMaterialContextToLocale({
        context: undefined,
        currentRoute,
        refs,
        targetRoute,
      })
    ).toBeUndefined();
    expect(
      projectMaterialContextToLocale({
        context: {
          nodeKey: "class-10-biology-virus-role",
          programKey: "merdeka",
        },
        currentRoute,
        refs,
        targetRoute,
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
        candidate.sourcePath ===
          "material/lesson/mathematics/linear-equation-inequality/system-linear-equation"
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

    const detachedRoute: PublicCurriculumRoute = {
      ...route,
      parentPath: undefined,
    };
    const exactLessonRoute: PublicCurriculumRoute = {
      ...route,
      canonicalPath: materialRoute.publicPath,
    };
    const unitRoute = curriculumRoutes.find(
      (candidate) =>
        candidate.locale === route.locale &&
        candidate.publicPath === route.parentPath
    );
    const subjectRoute = unitRoute?.parentPath
      ? curriculumRoutes.find(
          (candidate) =>
            candidate.locale === unitRoute.locale &&
            candidate.publicPath === unitRoute.parentPath
        )
      : undefined;
    const unitRouteWithoutCardTitle: PublicCurriculumRoute | undefined =
      unitRoute
        ? {
            ...unitRoute,
            materialCardTitle: undefined,
          }
        : undefined;

    expect(
      listMaterialContextRefs({
        contentRoutes,
        curriculumRoutes: [detachedRoute],
      })
    ).toEqual([]);
    expect(addCurriculumMaterialContextOwnership([detachedRoute])).toEqual([
      detachedRoute,
    ]);
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
        curriculumRoutes: [
          ...(subjectRoute ? [subjectRoute] : []),
          ...(unitRoute ? [unitRoute] : []),
          exactLessonRoute,
        ],
      }).some((ref) => ref.sourcePath === materialRoute.sourcePath)
    ).toBe(true);
    expect(
      listMaterialContextRefs({
        contentRoutes,
        curriculumRoutes: [
          ...(subjectRoute ? [subjectRoute] : []),
          ...(unitRouteWithoutCardTitle ? [unitRouteWithoutCardTitle] : []),
          exactLessonRoute,
        ],
      }).find((ref) => ref.sourcePath === materialRoute.sourcePath)
    ).toMatchObject({
      parentTitle: unitRoute?.title,
    });
  });
});
