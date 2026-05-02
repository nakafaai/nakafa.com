import type { getPathname } from "@repo/internationalization/src/navigation";
import { routing } from "@repo/internationalization/src/routing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLocalizedLlmsEntries } from "@/lib/llms/entries";
import {
  buildRootLlmsIndexText,
  getLlmsSectionIndexText,
} from "@/lib/llms/indexes";
import { getSitemapRoutes } from "@/lib/sitemap";

type PathnameParams = Parameters<typeof getPathname>[number];

vi.mock("@repo/internationalization/src/navigation", () => ({
  getPathname: ({ href, locale }: PathnameParams) =>
    `/${locale}${typeof href === "string" ? href : href.pathname}`,
}));

const AF_DOCS_LLMS_SIZE_LIMIT = 50_000;
const LLMS_TITLE_WITH_SUMMARY_PATTERN = /^# .+\n\n> /;

describe("llms indexes", () => {
  it("builds a small root index with the standard title and summary", () => {
    const text = buildRootLlmsIndexText();

    expect(text.length).toBeLessThan(AF_DOCS_LLMS_SIZE_LIMIT);
    expect(text.startsWith("# Nakafa\n\n> ")).toBe(true);
    expect(text).toContain("https://nakafa.com/llms/en/llms.txt");
    expect(text).toContain("https://nakafa.com/llms/id/llms.txt");
    expect(text).toContain("https://nakafa.com/mcp");
    expect(text).toContain("https://nakafa.com/sitemap.xml");
  });

  it("builds small locale and section indexes with blockquote summaries", async () => {
    const slugs = routing.locales.flatMap((locale) => [
      `llms/${locale}`,
      `llms/${locale}/articles`,
      `llms/${locale}/subject`,
      `llms/${locale}/exercises`,
      `llms/${locale}/quran`,
      `llms/${locale}/site`,
    ]);

    for (const slug of slugs) {
      const text = await getLlmsSectionIndexText(slug);

      expect(text).not.toBeNull();
      expect(text?.length).toBeLessThan(AF_DOCS_LLMS_SIZE_LIMIT);
      expect(text).toMatch(LLMS_TITLE_WITH_SUMMARY_PATTERN);
    }
  }, 30_000);

  it("does not generate indexes for unknown llms paths", async () => {
    await expect(getLlmsSectionIndexText("docs")).resolves.toBeNull();
    await expect(getLlmsSectionIndexText("llms/fr")).resolves.toBeNull();
    await expect(
      getLlmsSectionIndexText("llms/en/unknown")
    ).resolves.toBeNull();
  });
});

describe("llms index route coverage", () => {
  const llmsSections = ["articles", "subject", "exercises", "quran", "site"];
  const mockCacheLife = vi.fn();
  const mockGetLocalizedLlmsEntries = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    mockCacheLife.mockClear();
    mockGetLocalizedLlmsEntries.mockReset();
    mockGetLocalizedLlmsEntries.mockResolvedValue([
      {
        description: "Subject landing",
        href: "https://nakafa.com/en/subject.md",
        route: "/subject",
        section: "subject",
        segments: ["subject"],
        title: "Subject",
      },
    ]);

    vi.doMock("next/cache", () => ({
      cacheLife: mockCacheLife,
    }));
    vi.doMock("@/lib/llms/entries", () => ({
      getLlmsSections: () => llmsSections,
      getLocalizedLlmsEntries: mockGetLocalizedLlmsEntries,
      isLlmsSection: (section: string | undefined) =>
        typeof section === "string" && llmsSections.includes(section),
    }));
  });

  it("uses the cached wrapper without changing section output", async () => {
    const { getCachedLlmsSectionIndexText } = await import(
      "@/lib/llms/indexes"
    );

    await expect(
      getCachedLlmsSectionIndexText({ cleanSlug: "llms/en" })
    ).resolves.toContain("# Nakafa English Docs");

    expect(mockCacheLife).toHaveBeenCalledWith("max");
  });

  it("returns null for missing scoped entries", async () => {
    const { getLlmsSectionIndexText: getText } = await import(
      "@/lib/llms/indexes"
    );

    await expect(getText("llms/en/articles/missing")).resolves.toBeNull();
  });

  it("splits large nested indexes into child links while keeping direct pages", async () => {
    mockGetLocalizedLlmsEntries.mockResolvedValue([
      {
        description: "Direct high school page",
        href: "https://nakafa.com/en/subject/high-school.md",
        route: "/subject/high-school",
        section: "subject",
        segments: ["subject", "high-school"],
        title: "High School",
      },
      ...Array.from({ length: 8 }, (_, index) => ({
        description: "x".repeat(7000),
        href: `https://nakafa.com/en/subject/high-school/topic-${index}.md`,
        route: `/subject/high-school/topic-${index}`,
        section: "subject",
        segments: ["subject", "high-school", `topic-${index}`],
        title: `Topic ${index}`,
      })),
    ]);
    const { getLlmsSectionIndexText: getText } = await import(
      "@/lib/llms/indexes"
    );

    const text = await getText("llms/en/subject/high-school");

    expect(text).toContain("# Nakafa English Subject: High School Index");
    expect(text).toContain("[Topic 0]");
    expect(text).toContain("[High School]");
  });

  it("splits large nested indexes without direct pages", async () => {
    mockGetLocalizedLlmsEntries.mockResolvedValue(
      Array.from({ length: 8 }, (_, index) => ({
        description: "x".repeat(7000),
        href: `https://nakafa.com/en/subject/high-school/topic-${index}.md`,
        route: `/subject/high-school/topic-${index}`,
        section: "subject",
        segments: ["subject", "high-school", `topic-${index}`],
        title: `Topic ${index}`,
      }))
    );
    const { getLlmsSectionIndexText: getText } = await import(
      "@/lib/llms/indexes"
    );

    const text = await getText("llms/en/subject/high-school");

    expect(text).toContain("# Nakafa English Subject: High School Index");
    expect(text).toContain("[Topic 0]");
  });
});

describe("llms sitemap alignment", () => {
  it("covers sitemap routes without stale same-origin links", async () => {
    const sitemapRoutes = new Set(getSitemapRoutes());

    for (const locale of routing.locales) {
      const entries = await getLocalizedLlmsEntries(locale);
      const entryRoutes = new Set(entries.map((entry) => entry.route));

      expect(entryRoutes).toEqual(sitemapRoutes);

      for (const entry of entries) {
        const url = new URL(entry.href);
        const localePrefix = `/${locale}`;

        expect(url.origin).toBe("https://nakafa.com");
        expect(url.pathname.startsWith(localePrefix)).toBe(true);

        const localizedPath = url.pathname.slice(localePrefix.length) || "/";
        const route = localizedPath.endsWith(".md")
          ? localizedPath.slice(0, -".md".length) || "/"
          : localizedPath;

        expect(sitemapRoutes.has(route)).toBe(true);
      }
    }
  }, 30_000);

  it("uses markdown URLs for sitemap pages with markdown variants", async () => {
    const entries = await getLocalizedLlmsEntries("en");
    const exerciseEntries = entries.filter((entry) =>
      entry.route.startsWith("/exercises/")
    );

    expect(
      entries.some(
        (entry) =>
          entry.route.startsWith("/subject/") && entry.href.endsWith(".md")
      )
    ).toBe(true);
    expect(
      entries.some(
        (entry) =>
          entry.route.startsWith("/quran") && entry.href.endsWith(".md")
      )
    ).toBe(true);
    expect(exerciseEntries.some((entry) => entry.href.endsWith(".md"))).toBe(
      true
    );
    expect(
      exerciseEntries.some(
        (entry) =>
          entry.route === "/exercises/high-school" &&
          !entry.href.endsWith(".md")
      )
    ).toBe(true);
  }, 30_000);
});
