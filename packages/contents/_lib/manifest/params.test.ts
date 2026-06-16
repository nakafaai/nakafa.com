import { getStaticParams } from "@repo/contents/_lib/manifest/params";
import { describe, expect, it } from "vitest";

describe("content manifest params", () => {
  it("adds material exercise set params only when folder candidates omit them", () => {
    const inferredSet =
      "material/practice/assessment/snbt/domain/group/set-1/question-1";
    const existingSet =
      "material/practice/assessment/snbt/domain/group/set-2/question-1";
    const existingSetSlug = [
      "practice",
      "assessment",
      "snbt",
      "domain",
      "group",
      "set-2",
    ];
    const params = getStaticParams(
      [
        {
          locale: "en",
          slugs: [inferredSet, existingSet],
        },
      ],
      [
        {
          fullPath: `material/${existingSetSlug.join("/")}`,
          slugParts: ["material", ...existingSetSlug],
        },
      ]
    );

    expect(params.material).toContainEqual({
      locale: "en",
      slug: ["practice", "assessment", "snbt", "domain", "group", "set-1"],
    });
    expect(
      params.material.filter(
        (param) => param.slug.join("/") === existingSetSlug.join("/")
      )
    ).toHaveLength(1);
  });
});
