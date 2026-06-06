// @vitest-environment node
import type { getPathname } from "@repo/internationalization/src/navigation";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { getLocalizedLlmsEntries, LlmsEntry } from "@/lib/llms/entries";
import {
  buildLlmsSectionIndexTextFromEntries,
  buildRootLlmsIndexText,
  getCachedLlmsSectionIndexText,
  getLlmsSectionIndexText,
} from "@/lib/llms/indexes";

const mockCacheLife = vi.hoisted(() => vi.fn());
const mockGetPathname = vi.hoisted(() =>
  vi.fn<typeof getPathname>(
    ({ href, locale }) =>
      `/${locale}${typeof href === "string" ? href : href.pathname}`
  )
);
const mockGetLocalizedLlmsEntries = vi.hoisted(() =>
  vi.fn<typeof getLocalizedLlmsEntries>()
);

const sectionIndexSlugs = routing.locales.flatMap((locale) => [
  `llms/${locale}`,
  `llms/${locale}/articles`,
  `llms/${locale}/subject`,
  `llms/${locale}/exercises`,
  `llms/${locale}/quran`,
  `llms/${locale}/site`,
]);

vi.mock("next/cache", () => ({
  cacheLife: mockCacheLife,
}));

vi.mock("@repo/internationalization/src/navigation", () => ({
  getPathname: mockGetPathname,
}));

vi.mock("@/lib/llms/entries", async () => {
  const constants = await import("@/lib/llms/constants");

  const isLlmsSection = (section: unknown) =>
    typeof section === "string" &&
    Object.hasOwn(constants.SECTION_LABELS, section);

  return {
    getLlmsSections: () => Object.keys(constants.SECTION_LABELS),
    getLocalizedLlmsEntries: mockGetLocalizedLlmsEntries,
    isLlmsSection,
  };
});

const AF_DOCS_LLMS_SIZE_LIMIT = 50_000;
const LLMS_TITLE_WITH_SUMMARY_PATTERN = /^# .+\n\n> /;
const LONG_DESCRIPTION = "Detailed sitemap summary for generated fixtures. ";

beforeEach(() => {
  mockCacheLife.mockClear();
  mockGetLocalizedLlmsEntries.mockImplementation(
    (locale: (typeof routing.locales)[number]) =>
      Effect.succeed(createFixtureEntries(locale))
  );
  mockGetPathname.mockClear();
});

describe("llms indexes", () => {
  it("builds a small root index with the standard title and summary", () => {
    const text = buildRootLlmsIndexText();

    expect(text.length).toBeLessThan(AF_DOCS_LLMS_SIZE_LIMIT);
    expect(text.startsWith("# Nakafa\n\n> ")).toBe(true);
    expect(text).toContain("https://nakafa.com/llms/en/llms.txt");
    expect(text).toContain("https://nakafa.com/llms/id/llms.txt");
    expect(text).toContain("https://nakafa.com/mcp");
    expect(text).toContain("https://nakafa.com/llms-full.txt");
    expect(text).toContain("https://nakafa.com/llms-full/index.json");
    expect(text).toContain("https://nakafa.com/sitemap.xml");
    expect(text).not.toContain("[MCP server]");
    expect(text).not.toContain("[Sitemap]");
  });

  it.each(
    sectionIndexSlugs
  )("builds a small locale or section index with a blockquote summary for %s", (slug) => {
    const locale = getLocaleFromLlmsSlug(slug);
    const text = buildLlmsSectionIndexTextFromEntries({
      cleanSlug: slug,
      entries: createFixtureEntries(locale),
    });

    expect(text).not.toBeNull();
    expect(text?.length).toBeLessThan(AF_DOCS_LLMS_SIZE_LIMIT);
    expect(text).toMatch(LLMS_TITLE_WITH_SUMMARY_PATTERN);
  });

  it("does not generate indexes for unknown llms paths", async () => {
    await expect(
      Effect.runPromise(getLlmsSectionIndexText("docs"))
    ).resolves.toBeNull();
    await expect(
      Effect.runPromise(getLlmsSectionIndexText("llms/fr"))
    ).resolves.toBeNull();
    await expect(
      Effect.runPromise(getLlmsSectionIndexText("llms/en/unknown"))
    ).resolves.toBeNull();
    expect(
      buildLlmsSectionIndexTextFromEntries({
        cleanSlug: "docs",
        entries: createFixtureEntries("en"),
      })
    ).toBeNull();
    expect(
      buildLlmsSectionIndexTextFromEntries({
        cleanSlug: "llms/en/unknown",
        entries: createFixtureEntries("en"),
      })
    ).toBeNull();
  });

  it("uses the Next cache boundary without changing section output", async () => {
    await expect(
      getCachedLlmsSectionIndexText({ cleanSlug: "llms/en" })
    ).resolves.toContain("# Nakafa English Content");

    expect(mockCacheLife).toHaveBeenCalledWith("max");
  });

  it("uses localized entries for production section indexes", async () => {
    await expect(
      Effect.runPromise(getLlmsSectionIndexText("llms/en/articles"))
    ).resolves.toContain("# Nakafa English Articles Index");

    expect(mockGetLocalizedLlmsEntries).toHaveBeenCalledWith("en");
  });

  it("returns null for missing scoped entries", () => {
    expect(
      buildLlmsSectionIndexTextFromEntries({
        cleanSlug: "llms/en/articles/politics/missing",
        entries: createFixtureEntries("en"),
      })
    ).toBeNull();
    expect(
      buildLlmsSectionIndexTextFromEntries({
        cleanSlug: "llms/en/articles/news",
        entries: createFixtureEntries("en"),
      })
    ).toBeNull();
  });

  it("splits large nested indexes into child route groups", () => {
    const text = buildLlmsSectionIndexTextFromEntries({
      cleanSlug: "llms/en/subject/high-school",
      entries: createLargeHighSchoolEntries("en"),
    });

    expect(text).toContain("# Nakafa English Subject: High School Index");
    expect(text).toContain("Sitemap group");
    expect(text).toContain(
      "https://nakafa.com/llms/en/subject/high-school/10/llms.txt"
    );
    expect(text).toContain(
      "- [High School](https://nakafa.com/en/subject/high-school.md)"
    );
  });
});

/** Reads the locale segment from one fixture llms slug. */
function getLocaleFromLlmsSlug(slug: string) {
  const locale = routing.locales.find((currentLocale) =>
    slug.startsWith(`llms/${currentLocale}`)
  );

  if (!locale) {
    throw new Error(`Fixture slug must include a supported locale: ${slug}`);
  }

  return locale;
}

/** Builds the smallest entry set needed to exercise each section index. */
function createFixtureEntries(locale: (typeof routing.locales)[number]) {
  return [
    createFixtureEntry({
      locale,
      route: "/articles/politics",
      title: "Politics",
    }),
    createFixtureEntry({
      locale,
      route: "/exercises/high-school/snbt",
      title: "SNBT",
    }),
    createFixtureEntry({
      locale,
      route: "/quran",
      title: "Al-Quran",
    }),
    createFixtureEntry({
      locale,
      route: "/search",
      title: "Search",
    }),
    createFixtureEntry({
      locale,
      route: "/subject/high-school/11/physics",
      title: "Grade 11 Physics",
    }),
  ];
}

/** Builds enough nested entries to force the child-index splitting branch. */
function createLargeHighSchoolEntries(
  locale: (typeof routing.locales)[number]
) {
  const parentEntry = createFixtureEntry({
    description: LONG_DESCRIPTION,
    locale,
    route: "/subject/high-school",
    title: "High School",
  });
  const childEntries = Array.from({ length: 360 }, (_, index) => {
    const grade = String(10 + (index % 3));
    const topic = `topic-${index + 1}`;

    return createFixtureEntry({
      description: LONG_DESCRIPTION.repeat(5),
      locale,
      route: `/subject/high-school/${grade}/physics/${topic}`,
      title: `Physics ${topic}`,
    });
  });

  return [parentEntry, ...childEntries];
}

/** Creates one sitemap-shaped llms entry without reading the content corpus. */
function createFixtureEntry({
  description,
  locale,
  route,
  title,
}: {
  description?: string;
  locale: (typeof routing.locales)[number];
  route: string;
  title: string;
}): LlmsEntry {
  const routeSegments = route.split("/").filter(Boolean);
  const section = getFixtureRouteSection(route);
  const segments =
    section === "site" ? ["site", ...routeSegments] : routeSegments;

  return {
    description,
    href: `https://nakafa.com/${locale}${route}.md`,
    route,
    section,
    segments,
    title,
  };
}

/** Mirrors route section ownership for fixture routes. */
function getFixtureRouteSection(route: string): LlmsEntry["section"] {
  const firstSegment = route.split("/").filter(Boolean)[0];

  if (firstSegment === "articles") {
    return "articles";
  }

  if (firstSegment === "exercises") {
    return "exercises";
  }

  if (firstSegment === "quran") {
    return "quran";
  }

  if (firstSegment === "subject") {
    return "subject";
  }

  return "site";
}
