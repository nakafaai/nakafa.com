import { getStaticParams } from "@repo/contents/_lib/manifest/params";
import { describe, expect, it } from "vitest";

describe("content manifest params", () => {
  it("keeps root-relative folder and source params unique", () => {
    const sourcePage = "material/lesson/mathematics/domain/source-page";
    const existingSourcePage =
      "material/lesson/mathematics/domain/existing-page";
    const existingFolderSlug = ["lesson", "mathematics", "domain"];
    const params = getStaticParams(
      [
        {
          locale: "en",
          slugs: [sourcePage, existingSourcePage],
        },
      ],
      [
        {
          fullPath: `material/${existingFolderSlug.join("/")}`,
          slugParts: ["material", ...existingFolderSlug],
        },
      ]
    );

    expect(params.material).toContainEqual({
      locale: "en",
      slug: ["lesson", "mathematics", "domain", "source-page"],
    });
    expect(
      params.material.filter(
        (param) => param.slug.join("/") === existingFolderSlug.join("/")
      )
    ).toHaveLength(1);
  });
});
