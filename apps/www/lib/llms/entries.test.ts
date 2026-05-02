import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getLlmsSections,
  getLocalizedLlmsEntries,
  getRouteSection,
  isLlmsSection,
} from "@/lib/llms/entries";

const mockGetContentMetadata = vi.hoisted(() => vi.fn());

vi.mock("@/lib/sitemap/routes", () => ({
  getSitemapRoutes: () => [
    "/",
    "/articles/politics",
    "/articles/politics/dynastic-politics-asian-values",
    "/exercises/high-school/snbt/quantitative-knowledge/try-out/2026",
    "/quran",
    "/subject/high-school/10",
    "/subject/high-school/10/chemistry/green-chemistry/definition",
  ],
}));

vi.mock("@/lib/llms/quran", () => ({
  getQuranRouteMetadata: () => ({
    description: "Quran index",
    hasMarkdown: true,
    title: "Al-Quran",
  }),
}));

vi.mock("@repo/contents/_lib/metadata", () => ({
  getContentMetadata: mockGetContentMetadata,
}));

beforeEach(() => {
  mockGetContentMetadata.mockImplementation((path) => {
    if (path === "articles/politics/dynastic-politics-asian-values") {
      return Effect.succeed({
        description:
          "Power is passed down under the guise of practicing asian values.",
        title:
          "Framing Dynastic Politics in Local Elections within Asian Values",
      });
    }

    if (
      path === "subject/high-school/10/chemistry/green-chemistry/definition"
    ) {
      return Effect.succeed({
        subject: "Green Chemistry",
        title: "Definition of Green Chemistry",
      });
    }

    return Effect.fail(new Error("missing metadata"));
  });
});

describe("llms entries", () => {
  it("classifies supported llms sections and falls back to site", () => {
    expect(getRouteSection("/articles/politics")).toBe("articles");
    expect(getRouteSection("/site/about")).toBe("site");
    expect(getRouteSection("/")).toBe("site");
    expect(isLlmsSection("articles")).toBe(true);
    expect(isLlmsSection("unknown")).toBe(false);
    expect(isLlmsSection(undefined)).toBe(false);
    expect(getLlmsSections()).toEqual([
      "articles",
      "exercises",
      "quran",
      "site",
      "subject",
    ]);
  });

  it("builds localized entries with markdown links and metadata subject fallback", async () => {
    const entries = await getLocalizedLlmsEntries("en");

    expect(entries).toContainEqual(
      expect.objectContaining({
        description:
          "Power is passed down under the guise of practicing asian values.",
        href: "https://nakafa.com/en/articles/politics/dynastic-politics-asian-values.md",
        route: "/articles/politics/dynastic-politics-asian-values",
        section: "articles",
        title:
          "Framing Dynastic Politics in Local Elections within Asian Values",
      })
    );
    expect(entries).toContainEqual(
      expect.objectContaining({
        description: "Green Chemistry",
        href: "https://nakafa.com/en/subject/high-school/10/chemistry/green-chemistry/definition.md",
        route: "/subject/high-school/10/chemistry/green-chemistry/definition",
        section: "subject",
        title: "Definition of Green Chemistry",
      })
    );
    expect(entries).toContainEqual(
      expect.objectContaining({
        href: "https://nakafa.com/en/subject/high-school/10.md",
        route: "/subject/high-school/10",
        section: "subject",
        title: "10",
      })
    );
    expect(entries).toContainEqual(
      expect.objectContaining({
        href: "https://nakafa.com/en/exercises/high-school/snbt/quantitative-knowledge/try-out/2026.md",
        route:
          "/exercises/high-school/snbt/quantitative-knowledge/try-out/2026",
        section: "exercises",
        title: "2026",
      })
    );
    expect(entries).toContainEqual(
      expect.objectContaining({
        href: "https://nakafa.com/en",
        route: "/",
        section: "site",
        title: "Home",
      })
    );
  });
});
