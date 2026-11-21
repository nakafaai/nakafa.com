import { describe, expect, it } from "@effect/vitest";
import { tryoutSectionPartsOf } from "@/components/tryout/section/model";

describe("tryoutSectionPartsOf", () => {
  it("offers the set's sections that have a page of their own, in order", () => {
    expect(
      tryoutSectionPartsOf([
        {
          publicPath: "try-out/a/b/c/d/set-1/one",
          sectionKey: "one",
          title: "One",
        },
        { sectionKey: "entry", title: "Entry" },
        {
          publicPath: "try-out/a/b/c/d/set-1/two",
          sectionKey: "two",
          title: "Two",
        },
      ])
    ).toEqual([
      { key: "one", label: "One", publicPath: "try-out/a/b/c/d/set-1/one" },
      { key: "two", label: "Two", publicPath: "try-out/a/b/c/d/set-1/two" },
    ]);
  });
});
