// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createBreadcrumbItems } from "@/lib/utils/seo/breadcrumbs";

describe("createBreadcrumbItems", () => {
  it("builds localized BreadcrumbList items from page hierarchy entries", () => {
    const result = createBreadcrumbItems("id", [
      { name: "Beranda", path: "" },
      { name: "Mata pelajaran", path: "/subject" },
      { name: "SMA", path: "/subject/high-school/11" },
      {
        name: "Grafik Fungsi Trigonometri",
        path: "/subject/high-school/11/mathematics/function-modeling/trigonometric-function-graph",
      },
    ]);

    expect(result).toEqual([
      {
        "@type": "ListItem",
        position: 1,
        name: "Beranda",
        item: "https://nakafa.com/id",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Mata pelajaran",
        item: "https://nakafa.com/id/subject",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "SMA",
        item: "https://nakafa.com/id/subject/high-school/11",
      },
      {
        "@type": "ListItem",
        position: 4,
        name: "Grafik Fungsi Trigonometri",
        item: "https://nakafa.com/id/subject/high-school/11/mathematics/function-modeling/trigonometric-function-graph",
      },
    ]);
  });

  it("normalizes paths that do not include a leading slash", () => {
    const result = createBreadcrumbItems("en", [
      { name: "Home", path: "/" },
      { name: "Articles", path: "articles" },
    ]);

    expect(result).toEqual([
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://nakafa.com/en",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Articles",
        item: "https://nakafa.com/en/articles",
      },
    ]);
  });
});
