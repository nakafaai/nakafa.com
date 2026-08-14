import { MaterialKeySchema } from "@nakafa/aksara-contracts/projection/material";
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
import { describe, expect, it } from "vitest";

const SOURCE_PATH =
  "material/lesson/mathematics/linear-equation-inequality/system-linear-equation";
const MATERIAL_KEY = MaterialKeySchema.make(
  "lesson.mathematics.linear-equation-inequality"
);
const PUBLIC_PATH =
  "materi/matematika/sistem-persamaan-dan-pertidaksamaan-linear/sistem-persamaan-linear";
const currentRoute = {
  locale: "id",
  materialKey: MATERIAL_KEY,
  sourcePath: SOURCE_PATH,
} satisfies MaterialRouteIdentity;
const targetRoute = {
  ...currentRoute,
  locale: "en",
} satisfies MaterialRouteIdentity;

/** Builds the minimum signed-route reference required by URL helpers. */
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
    const merdekaRef = makeMerdekaRef(currentRoute);
    const refs = [merdekaRef];
    const href = `/id/${PUBLIC_PATH}`;

    expect(toContextualMaterialHref({ href, ref: merdekaRef })).toBe(
      `${href}?ctx=merdeka~class-10-mathematics-linear-equation-inequality`
    );
    expect(
      toContextualMaterialHref({
        href: `${href}?preview=true`,
        ref: merdekaRef,
      })
    ).toBe(
      `${href}?preview=true&ctx=merdeka~class-10-mathematics-linear-equation-inequality`
    );
    expect(
      resolveMaterialHeaderLink({
        context: merdekaRef,
        refs,
        route: currentRoute,
      })
    ).toEqual({
      href: merdekaRef.parentHref,
      label: merdekaRef.parentTitle,
    });
  });

  it("ignores missing, malformed, or mismatched material context hints", () => {
    const refs = [makeMerdekaRef(currentRoute)];

    expect(readMaterialContextHint("merdeka~node")).toEqual({
      nodeKey: "node",
      programKey: "merdeka",
    });
    expect(readMaterialContextHint(["merdeka~node"])).toBeUndefined();
    expect(readMaterialContextHint("merdeka")).toBeUndefined();
    expect(readMaterialContextHint("~node")).toBeUndefined();
    expect(
      toContextualMaterialHref({ href: `/id/${PUBLIC_PATH}`, ref: undefined })
    ).toBe(`/id/${PUBLIC_PATH}`);
    expect(
      resolveMaterialHeaderLink({
        context: undefined,
        refs,
        route: currentRoute,
      })
    ).toBeUndefined();
    expect(
      resolveMaterialHeaderLink({
        context: {
          nodeKey: "class-10-biology-virus-role",
          programKey: "merdeka",
        },
        refs,
        route: currentRoute,
      })
    ).toBeUndefined();
  });

  it("projects valid context hints by source identity", () => {
    const currentRef = makeMerdekaRef(currentRoute);
    const targetRef = makeMerdekaRef(targetRoute);
    const refs = [currentRef, targetRef];
    const context = {
      nodeKey: "class-10-mathematics-linear-equation-inequality",
      programKey: "merdeka",
    };

    expect(
      projectMaterialContextToLocale({
        context,
        currentRoute,
        refs,
        targetRoute,
      })
    ).toEqual(context);
    expect(
      projectMaterialContextToLocale({
        context,
        currentRoute,
        refs: [currentRef],
        targetRoute,
      })
    ).toBeUndefined();
    expect(
      projectMaterialContextToLocale({
        context,
        currentRoute,
        refs: [targetRef],
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
  });
});
