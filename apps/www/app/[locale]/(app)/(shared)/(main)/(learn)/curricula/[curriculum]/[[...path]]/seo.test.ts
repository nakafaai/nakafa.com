// @vitest-environment node

import {
  isRenderableCurriculumRoute,
  readCurriculumAncestors,
} from "@repo/contents/_types/route/curriculum";
import { assert, describe, expect, it } from "vitest";
import { readCurriculumRoutes } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/data";
import { readCurriculumSeoContext } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/seo";

/** Reads a known curriculum route fixture from projected static rows. */
function readRoute(publicPath: string) {
  const route = readCurriculumRoutes().find(
    (candidate) =>
      candidate.locale === "id" && candidate.publicPath === publicPath
  );

  assert(route, `Missing curriculum route fixture: ${publicPath}`);

  return route;
}

/** Builds SEO context with the same source-owned ancestor chain as the route. */
function readContext(route: ReturnType<typeof readRoute>) {
  const ancestors = readCurriculumAncestors(
    route,
    readCurriculumRoutes()
  ).filter(isRenderableCurriculumRoute);
  return readCurriculumSeoContext(route, ancestors);
}

describe("curriculum route SEO context", () => {
  it("keeps root curriculum metadata scoped to the program title", () => {
    const route = readRoute("kurikulum/merdeka");

    expect(readContext(route)).toMatchObject({
      type: "curriculum-context",
      level: "track",
      parent: undefined,
      program: undefined,
      data: {
        title: "Kurikulum Merdeka",
      },
    });
  });

  it("includes parent and program context for nested curriculum pages", () => {
    const route = readRoute("kurikulum/merdeka/kelas-10/biologi");

    expect(readContext(route)).toMatchObject({
      type: "curriculum-context",
      level: "subject",
      parent: "Kelas 10",
      program: "Kurikulum Merdeka",
      data: {
        title: "Biologi",
      },
    });
  });

  it("does not duplicate the root program as both parent and program", () => {
    const route = readRoute("kurikulum/merdeka/kelas-10");

    expect(readContext(route)).toMatchObject({
      level: "class",
      parent: "Kurikulum Merdeka",
      program: undefined,
      data: {
        title: "Kelas 10",
      },
    });
  });

  it("does not duplicate the program title when the current route already uses it", () => {
    const route = readRoute("kurikulum/merdeka/kelas-10");

    const ancestors = readCurriculumAncestors(
      route,
      readCurriculumRoutes()
    ).filter(isRenderableCurriculumRoute);
    expect(
      readCurriculumSeoContext(
        { ...route, title: "Kurikulum Merdeka" },
        ancestors
      )
    ).toMatchObject({
      parent: "Kurikulum Merdeka",
      program: undefined,
    });
  });
});
