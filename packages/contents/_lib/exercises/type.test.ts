import { getSubjects } from "@repo/contents/_lib/exercises/type";
import { describe, expect, it } from "vitest";

describe("getSubjects", () => {
  it("derives SNBT materials from existing material folders", () => {
    expect(getSubjects("high-school", "snbt")).toEqual([
      {
        href: "/exercises/high-school/snbt/quantitative-knowledge",
        label: "quantitative-knowledge",
      },
      {
        href: "/exercises/high-school/snbt/mathematical-reasoning",
        label: "mathematical-reasoning",
      },
      {
        href: "/exercises/high-school/snbt/general-reasoning",
        label: "general-reasoning",
      },
      {
        href: "/exercises/high-school/snbt/indonesian-language",
        label: "indonesian-language",
      },
      {
        href: "/exercises/high-school/snbt/english-language",
        label: "english-language",
      },
      {
        href: "/exercises/high-school/snbt/general-knowledge",
        label: "general-knowledge",
      },
      {
        href: "/exercises/high-school/snbt/reading-and-writing-skills",
        label: "reading-and-writing-skills",
      },
    ]);
  });

  it("derives middle-school materials from existing material folders", () => {
    expect(getSubjects("middle-school", "grade-9")).toEqual([
      {
        href: "/exercises/middle-school/grade-9/mathematics",
        label: "mathematics",
      },
    ]);
  });

  it("returns no subjects when a type has no material folders", () => {
    expect(getSubjects("middle-school", "snbt")).toEqual([]);
  });
});
