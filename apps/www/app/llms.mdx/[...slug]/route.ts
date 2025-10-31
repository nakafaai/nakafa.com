import { getAllSurah, getSurah, getSurahName } from "@repo/contents/_lib/quran";
import {
  getContent,
  getFolderChildNames,
  getNestedSlugs,
} from "@repo/contents/_lib/utils";
import { routing } from "@repo/internationalization/src/routing";
import type { NextRequest } from "next/server";
import { hasLocale, type Locale } from "next-intl";
import { getRawGithubUrl } from "@/lib/utils/github";

const TOTAL_SURAH = 114;

function buildHeader({
  url,
  description,
  source,
}: {
  url: string;
  description: string;
  source?: string;
}): string[] {
  const header = ["# Nakafa Framework: LLM", "", `URL: ${url}`];

  if (source) {
    header.push(`Source: ${source}`);
  }

  header.push("", description, "", "---", "");

  return header;
}

function getTranslation(
  translations: Record<Locale, string>,
  locale: Locale
): string {
  return translations[locale] || translations.en;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const slug = (await params).slug;
  const baseUrl = new URL(req.url).origin;

  // Parse locale from slug
  const locale: Locale = hasLocale(routing.locales, slug[0])
    ? slug[0]
    : routing.defaultLocale;
  const cleanSlug = hasLocale(routing.locales, slug[0])
    ? slug.slice(1).join("/")
    : slug.join("/");

  // Handle Quran content
  if (cleanSlug.startsWith("quran")) {
    const quranResponse = handleQuranContent({
      cleanSlug,
      locale,
      baseUrl,
    });
    if (quranResponse) {
      return quranResponse;
    }
  }

  // Handle MDX content
  const content = await getContent(locale, cleanSlug);
  if (content) {
    return buildMdxResponse({ content, locale, cleanSlug, baseUrl });
  }

  // Fallback to /llms.txt for everything not found
  const fallbackUrl = new URL("/llms.txt", req.url);
  const response = await fetch(fallbackUrl);
  return new Response(await response.text());
}

function handleQuranContent({
  cleanSlug,
  locale,
  baseUrl,
}: {
  cleanSlug: string;
  locale: Locale;
  baseUrl: string;
}): Response | null {
  const parts = cleanSlug.split("/");
  const scanned: string[] = [];

  // List all surahs
  if (parts.length === 1) {
    const surahs = getAllSurah();
    const url = `${baseUrl}/${locale}/quran`;
    scanned.push(
      ...buildHeader({
        url,
        description: "Al-Quran - List of all 114 Surahs in the Holy Quran.",
      })
    );

    for (const surah of surahs) {
      const title = getSurahName({ locale, name: surah.name });
      const translation = getTranslation(surah.name.translation, locale);
      scanned.push(`## ${surah.number}. ${title}`);
      scanned.push("");
      scanned.push(`**Translation:** ${translation}`);
      scanned.push("");
      scanned.push(`**Revelation:** ${surah.revelation.en}`);
      scanned.push("");
      scanned.push(`**Number of Verses:** ${surah.numberOfVerses}`);
      scanned.push("");
    }

    return new Response(scanned.join("\n"));
  }

  // Show specific surah
  if (parts.length === 2) {
    const surahNumber = Number(parts[1]);
    const surahData = getSurah(surahNumber);

    if (surahData) {
      const title = getSurahName({ locale, name: surahData.name });
      const translation = getTranslation(surahData.name.translation, locale);
      const url = `${baseUrl}/${locale}/quran/${surahNumber}`;

      scanned.push(
        ...buildHeader({
          url,
          description: `Al-Quran - Surah ${title} (${translation})`,
        })
      );

      scanned.push(`## ${title}`);
      scanned.push("");
      scanned.push(`**Translation:** ${translation}`);
      scanned.push(`**Revelation:** ${surahData.revelation.en}`);
      scanned.push(`**Number of Verses:** ${surahData.numberOfVerses}`);
      scanned.push("");

      // Add pre-bismillah if exists
      if (surahData.preBismillah) {
        scanned.push("### Pre-Bismillah");
        scanned.push("");
        scanned.push(surahData.preBismillah.text.arab);
        scanned.push("");
        const preBismillahTranslation = getTranslation(
          surahData.preBismillah.translation,
          locale
        );
        scanned.push(`*${preBismillahTranslation}*`);
        scanned.push("");
      }

      // Add all verses
      scanned.push("### Verses");
      scanned.push("");

      for (const verse of surahData.verses) {
        scanned.push(`#### Verse ${verse.number.inSurah}`);
        scanned.push("");
        scanned.push(verse.text.arab);
        scanned.push("");
        scanned.push(`**Transliteration:** ${verse.text.transliteration.en}`);
        scanned.push("");
        scanned.push(
          `**Translation:** ${getTranslation(verse.translation, locale)}`
        );
        scanned.push("");
      }

      return new Response(scanned.join("\n"));
    }
  }

  return null;
}

function buildMdxResponse({
  content,
  locale,
  cleanSlug,
  baseUrl,
}: {
  content: NonNullable<Awaited<ReturnType<typeof getContent>>>;
  locale: Locale;
  cleanSlug: string;
  baseUrl: string;
}): Response {
  const url = `${baseUrl}/${locale}/${cleanSlug}`;
  const source = getRawGithubUrl(
    `/packages/contents/${cleanSlug}/${locale}.mdx`
  );

  const scanned = [
    ...buildHeader({
      url,
      description: "Output docs content for large language models.",
      source,
    }),
    content.raw,
  ];

  return new Response(scanned.join("\n"));
}

export function generateStaticParams() {
  // Top level directories in contents
  const topDirs = getFolderChildNames(".");
  const result: { slug: string[] }[] = [];
  const locales = routing.locales;

  // For each locale
  for (const locale of locales) {
    result.push({
      slug: [locale],
    });

    // For each top directory (articles, subject, etc)
    for (const topDir of topDirs) {
      // Get all nested paths starting from this folder
      const nestedPaths = getNestedSlugs(topDir);

      // Add the top-level folder itself
      result.push({
        slug: [locale, topDir],
      });

      // Add each nested path
      for (const path of nestedPaths) {
        result.push({
          slug: [locale, topDir, ...path],
        });
      }
    }

    // Add Quran pages
    result.push({
      slug: [locale, "quran"],
    });

    // Add all surah pages (1-114)
    const surahParams = Array.from({ length: TOTAL_SURAH }, (_, i) => ({
      slug: [locale, "quran", (i + 1).toString()],
    }));
    result.push(...surahParams);
  }

  return result;
}
