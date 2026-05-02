import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getLlmsSections,
  getLocalizedLlmsEntries,
  getRouteSection,
  isLlmsSection,
} from "@/lib/llms/entries";

const mockGetContentMetadata = vi.hoisted(() => vi.fn());

vi.mock("@/lib/sitemap", () => ({
  getSitemapRoutes: () => [
    "/",
    "/articles/story",
    "/exercises/set",
    "/quran",
    "/subject/topic",
  ],
}));

vi.mock("@/lib/llms/exercises", () => ({
  getExerciseRouteMetadata: () => ({
    description: undefined,
    hasMarkdown: true,
    title: "Exercise Set",
  }),
  getExerciseSetRoutes: () => new Set(["/exercises/set"]),
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
    if (path === "articles/story") {
      return Effect.succeed({
        description: "Article description",
        title: "Article Story",
      });
    }

    if (path === "subject/topic") {
      return Effect.succeed({
        subject: "Subject fallback",
        title: "Subject Topic",
      });
    }

    return Effect.fail(new Error("missing metadata"));
  });
});

describe("llms entries", () => {
  it("classifies supported llms sections and falls back to site", () => {
    expect(getRouteSection("/articles/story")).toBe("articles");
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
        description: "Article description",
        href: "https://nakafa.com/en/articles/story.md",
        route: "/articles/story",
        section: "articles",
        title: "Article Story",
      })
    );
    expect(entries).toContainEqual(
      expect.objectContaining({
        description: "Subject fallback",
        href: "https://nakafa.com/en/subject/topic.md",
        route: "/subject/topic",
        section: "subject",
        title: "Subject Topic",
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
