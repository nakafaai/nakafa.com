import { describe, expect, it } from "vitest";
import { getSchoolClassesForumHref } from "@/components/school/classes/forum/helpers/routes";

describe("school/classes/forum/helpers/routes", () => {
  it("builds the forum feed href", () => {
    expect(
      getSchoolClassesForumHref({
        classRouteId: "class-route",
        queryString: "",
        slug: "nakafa",
      })
    ).toBe("/school/nakafa/classes/class-route/forum");
  });

  it("builds the forum detail href", () => {
    expect(
      getSchoolClassesForumHref({
        classRouteId: "class-route",
        forumId: "forum_1",
        queryString: "",
        slug: "nakafa",
      })
    ).toBe("/school/nakafa/classes/class-route/forum/forum_1");
  });

  it("preserves current search params", () => {
    expect(
      getSchoolClassesForumHref({
        classRouteId: "class-route",
        forumId: "forum_1",
        queryString: "q=math&sort=new",
        slug: "nakafa",
      })
    ).toBe("/school/nakafa/classes/class-route/forum/forum_1?q=math&sort=new");
  });
});
