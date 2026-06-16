import {
  getMaterialsPagination,
  getSlugPath,
} from "@repo/contents/_lib/curriculum/slug";
import { describe, expect, it } from "vitest";

const materials = [
  {
    href: "/curriculum/high-school/10/chemistry",
    items: [
      { href: "/first", title: "First" },
      { href: "/second", title: "Second" },
      { href: "/third", title: "Third" },
    ],
    title: "Chemistry",
  },
];

describe("subject slug routes", () => {
  it("builds the nested subject content path", () => {
    expect(
      getSlugPath("high-school", "10", "chemistry", ["chapter", "lesson"])
    ).toBe("/material/lesson/chemistry/chapter/lesson");
  });

  it("returns empty pagination when the current path is missing", () => {
    expect(getMaterialsPagination("/missing", materials)).toEqual({
      next: { href: "", title: "" },
      prev: { href: "", title: "" },
    });
  });

  it("builds pagination at the first item", () => {
    expect(getMaterialsPagination("/first", materials)).toEqual({
      next: { href: "/second", title: "Second" },
      prev: { href: "", title: "" },
    });
  });

  it("builds pagination at the middle item", () => {
    expect(getMaterialsPagination("/second", materials)).toEqual({
      next: { href: "/third", title: "Third" },
      prev: { href: "/first", title: "First" },
    });
  });

  it("builds pagination at the last item", () => {
    expect(getMaterialsPagination("/third", materials)).toEqual({
      next: { href: "", title: "" },
      prev: { href: "/second", title: "Second" },
    });
  });
});
