import { describe, expect, it } from "vitest";
import {
  groupCurriculumChildren,
  readMaterialCardChapters,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/data";

describe("curriculum presentation data", () => {
  it("groups children by the signed display label", () => {
    const first = { displayGroupTitle: "Primary", id: "first" };
    const second = { displayGroupTitle: "Primary", id: "second" };
    const ungrouped = { displayGroupTitle: undefined, id: "ungrouped" };

    expect(groupCurriculumChildren([first, second, ungrouped])).toEqual([
      {
        children: [first, second],
        key: "Primary",
        title: "Primary",
      },
      {
        children: [ungrouped],
        key: "curriculum",
        title: undefined,
      },
    ]);
  });

  it("builds material-card chapter links", () => {
    expect(
      readMaterialCardChapters([
        {
          description: "Composition and inverse functions",
          href: "/en/subjects/mathematics/functions/function-concept",
          items: [],
          title: "Function Composition and Inverses",
        },
      ])
    ).toEqual([
      {
        children: [],
        href: "#function-composition-and-inverses",
        label: "Function Composition and Inverses",
      },
    ]);
  });
});
