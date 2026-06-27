// @vitest-environment node

import { describe, expect, it } from "vitest";
import { readCurriculumRoutes } from "./data";
import { readCurriculumSeoContext } from "./seo";

/** Reads a known curriculum route fixture from projected static rows. */
function readRoute(publicPath: string) {
  const route = readCurriculumRoutes().find(
    (candidate) =>
      candidate.locale === "id" && candidate.publicPath === publicPath
  );

  expect(route).toBeDefined();

  return route;
}

describe("curriculum route SEO context", () => {
  it("keeps root curriculum metadata scoped to the program title", () => {
    const route = readRoute("kurikulum/merdeka");

    if (!route) {
      return;
    }

    expect(readCurriculumSeoContext(route)).toMatchObject({
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

    if (!route) {
      return;
    }

    expect(readCurriculumSeoContext(route)).toMatchObject({
      type: "curriculum-context",
      level: "subject",
      parent: "Kelas 10",
      program: "Kurikulum Merdeka",
      data: {
        title: "Biologi",
      },
    });
  });

  it("does not duplicate the program title when the current route already uses it", () => {
    const route = readRoute("kurikulum/merdeka/kelas-10");

    if (!route) {
      return;
    }

    expect(
      readCurriculumSeoContext({ ...route, title: "Kurikulum Merdeka" })
    ).toMatchObject({
      parent: "Kurikulum Merdeka",
      program: undefined,
    });
  });
});
