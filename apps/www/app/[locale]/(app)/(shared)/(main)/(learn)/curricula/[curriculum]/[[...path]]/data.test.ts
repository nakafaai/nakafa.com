import { describe, expect, it } from "@effect/vitest";
import { readMaterialCardChapters } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/data";

describe("curriculum presentation data", () => {
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
