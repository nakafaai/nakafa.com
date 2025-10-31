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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const slug = (await params).slug;
  const scanned: string[] = [];

  // get the locale from slug
  let locale: Locale;
  let cleanSlug: string;

  if (hasLocale(routing.locales, slug[0])) {
    locale = slug[0];
    cleanSlug = slug.slice(1).join("/");
  } else {
    locale = routing.defaultLocale;
    cleanSlug = slug.join("/");
  }

  // Handle Quran content
  if (cleanSlug.startsWith("quran")) {
    const parts = cleanSlug.split("/");

    // If just "quran", return list of all surahs
    if (parts.length === 1) {
      const surahs = getAllSurah();
      scanned.push("# Al-Quran");
      scanned.push("");
      scanned.push(`URL: /${locale}/quran`);
      scanned.push("");
      scanned.push("List of all 114 Surahs in the Holy Quran.");
      scanned.push("");
      scanned.push("---");
      scanned.push("");

      for (const surah of surahs) {
        const title = getSurahName({ locale, name: surah.name });
        const translation =
          surah.name.translation[locale] || surah.name.translation.en;
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

    // If "quran/[number]", return specific surah
    if (parts.length === 2) {
      const surahNumber = Number(parts[1]);
      const surahData = getSurah(surahNumber);

      if (surahData) {
        const title = getSurahName({ locale, name: surahData.name });
        const translation =
          surahData.name.translation[locale] || surahData.name.translation.en;

        scanned.push("# Al-Quran");
        scanned.push("");
        scanned.push(`URL: /${locale}/quran/${surahNumber}`);
        scanned.push("");
        scanned.push(`Surah ${title} - ${translation}`);
        scanned.push("");
        scanned.push("---");
        scanned.push("");
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
          const preBismillahTranslation =
            surahData.preBismillah.translation[locale] ||
            surahData.preBismillah.translation.en;
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
          const verseTranslation =
            verse.translation[locale] || verse.translation.en;
          scanned.push(`**Translation:** ${verseTranslation}`);
          scanned.push("");
        }

        return new Response(scanned.join("\n"));
      }
    }
  }

  const content = await getContent(locale, cleanSlug);

  if (!content) {
    const url = new URL("/llms.txt", req.url);
    const response = await fetch(url);
    const text = await response.text();
    return new Response(text);
  }

  // Construct the header information
  const urlPath = `/${locale}/${cleanSlug}`;
  const githubSourcePath = `/packages/contents/${cleanSlug}/${locale}.mdx`;

  scanned.push("# Nakafa Framework: LLM");
  scanned.push("");
  scanned.push(`URL: ${urlPath}`);
  scanned.push(`Source: ${getRawGithubUrl(githubSourcePath)}`);
  scanned.push("");
  scanned.push("Output docs content for large language models.");
  scanned.push("");
  scanned.push("---");
  scanned.push("");
  scanned.push(content.raw);

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
