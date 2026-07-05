// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createBreadcrumbItems } from "@/lib/utils/seo/breadcrumbs";

describe("createBreadcrumbItems", () => {
  it("builds localized BreadcrumbList items from page hierarchy entries", () => {
    const result = createBreadcrumbItems("id", [
      { name: "Beranda", path: "" },
      { name: "Kurikulum", path: "/kurikulum/merdeka" },
      { name: "Kelas 11", path: "/kurikulum/merdeka/kelas-11" },
      {
        name: "Integral",
        path: "/materi/matematika/integral",
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
        name: "Kurikulum",
        item: "https://nakafa.com/id/kurikulum/merdeka",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "Kelas 11",
        item: "https://nakafa.com/id/kurikulum/merdeka/kelas-11",
      },
      {
        "@type": "ListItem",
        position: 4,
        name: "Integral",
        item: "https://nakafa.com/id/materi/matematika/integral",
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

  it("does not double-prefix already localized paths", () => {
    const result = createBreadcrumbItems("en", [
      { name: "Home", path: "/en" },
      { name: "Try-out", path: "/en/try-out/indonesia/snbt" },
      { name: "Materials", path: "en/subjects/chemistry" },
    ]);

    expect(result.map((item) => item.item)).toEqual([
      "https://nakafa.com/en",
      "https://nakafa.com/en/try-out/indonesia/snbt",
      "https://nakafa.com/en/subjects/chemistry",
    ]);
    expect(result.map((item) => item.item).join("\n")).not.toContain("/en/en/");
  });
});
