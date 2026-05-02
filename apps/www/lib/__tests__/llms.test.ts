import { routing } from "@repo/internationalization/src/routing";
import { describe, expect, it, vi } from "vitest";
import { getLocalizedLlmsEntries } from "@/lib/llms/entries";
import {
  buildRootLlmsIndexText,
  getLlmsSectionIndexText,
} from "@/lib/llms/indexes";
import { getSitemapRoutes } from "@/lib/sitemap";

vi.mock("@repo/internationalization/src/navigation", () => ({
  getPathname: ({
    href,
    locale,
  }: {
    href: string | { pathname: string };
    locale: string;
  }) => `/${locale}${typeof href === "string" ? href : href.pathname}`,
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

  it("does not generate indexes for unknown llms paths", async () => {
    await expect(getLlmsSectionIndexText("docs")).resolves.toBeNull();
    await expect(
      getLlmsSectionIndexText("llms/en/unknown")
    ).resolves.toBeNull();
  });
});
