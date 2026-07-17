import { listPublicContentRoutes } from "@repo/contents/_types/route/content";
import {
  projectMaterialContextToLocale,
  readMaterialContextHint,
  resolveMaterialHeaderLink,
  toContextualMaterialHref,
} from "@repo/contents/_types/route/material/context";
import type {
  MaterialContextRef,
  MaterialRouteIdentity,
} from "@repo/contents/_types/route/material/reference";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const LESSON_SOURCE_PATH =
  "material/lesson/mathematics/linear-equation-inequality/system-linear-equation";

/** Builds the minimum source-owned reference required by material URL helpers. */
function makeMerdekaRef(route: MaterialRouteIdentity): MaterialContextRef {
  return {
    anchor: "linear-equations",
    locale: route.locale,
    materialKey: route.materialKey,
    nodeKey: "class-10-mathematics-linear-equation-inequality",
    parentHref: `/${route.locale}/curriculum#linear-equations`,
    parentTitle: "Linear equations",
    programKey: "merdeka",
    sourcePath: route.sourcePath,
  };
}

describe("material route context", () => {
  it("builds contextual material hrefs from curriculum card identity", () => {
    const contentRoutes = Effect.runSync(listPublicContentRoutes());
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

    const merdekaRef = makeMerdekaRef(route);
    const refs = [merdekaRef];

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

    const refs = [makeMerdekaRef(route)];

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
    const currentRoute = contentRoutes.find(
      (candidate) =>
        candidate.kind === "subject-lesson" &&
        candidate.locale === "id" &&
        candidate.sourcePath === LESSON_SOURCE_PATH
    );
    const targetRoute = contentRoutes.find(
      (candidate) =>
        candidate.kind === "subject-lesson" &&
        candidate.locale === "en" &&
        candidate.sourcePath === LESSON_SOURCE_PATH
    );

    expect(currentRoute).toBeDefined();
    expect(targetRoute).toBeDefined();

    if (!(currentRoute && targetRoute)) {
      return;
    }

    const currentRef = makeMerdekaRef(currentRoute);
    const targetRef = makeMerdekaRef(targetRoute);
    const refs = [currentRef, targetRef];
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
        refs: [currentRef],
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
});
