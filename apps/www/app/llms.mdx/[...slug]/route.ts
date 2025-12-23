import {
  getCurrentMaterial,
  getMaterialPath,
  getMaterials,
} from "@repo/contents/_lib/exercises/material";
import { getAllSurah, getSurah, getSurahName } from "@repo/contents/_lib/quran";
import {
  getContent,
  getExercisesContent,
  getFolderChildNames,
  getNestedSlugs,
} from "@repo/contents/_lib/utils";
import type { ExercisesCategory } from "@repo/contents/_types/exercises/category";
import type { ExercisesMaterial } from "@repo/contents/_types/exercises/material";
import type { ExercisesType } from "@repo/contents/_types/exercises/type";
import { routing } from "@repo/internationalization/src/routing";
import ky from "ky";
import type { NextRequest } from "next/server";
import { hasLocale, type Locale } from "next-intl";
import { getRawGithubUrl } from "@/lib/utils/github";

const TOTAL_SURAH = 114;
const BASE_URL = "https://nakafa.com";

export const revalidate = false;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const slug = (await params).slug;

  // Parse locale from slug
  const locale: Locale = hasLocale(routing.locales, slug[0])
    ? slug[0]
    : routing.defaultLocale;
  let cleanSlug = hasLocale(routing.locales, slug[0])
    ? slug.slice(1).join("/")
    : slug.join("/");

  // if last element is /llms.txt, we must remove it
  if (cleanSlug.endsWith("/llms.txt")) {
    cleanSlug = cleanSlug.slice(0, -"/llms.txt".length);
  }

  // Handle Quran content
  if (cleanSlug.startsWith("quran")) {
    const quranResponse = handleQuranContent({
      cleanSlug,
      locale,
    });
    if (quranResponse) {
      return quranResponse;
    }
  }

  // Handle Exercises content
  if (cleanSlug.startsWith("exercises")) {
    const exercisesResponse = await handleExercisesContent({
      cleanSlug,
      locale,
    });
    if (exercisesResponse) {
      return exercisesResponse;
    }
  }

  // Handle MDX content
  const content = await getContent(locale, cleanSlug);
  if (content) {
    return buildMdxResponse({ content, locale, cleanSlug });
  }

  // Fallback to /llms.txt for everything not found
  const fallbackResponse = await ky
    .get(`${BASE_URL}/llms.txt`, {
      cache: "force-cache",
    })
    .text()
    .catch(() => "");
  return new Response(fallbackResponse);
}

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

function handleQuranContent({
  cleanSlug,
  locale,
}: {
  cleanSlug: string;
  locale: Locale;
}): Response | null {
  const parts = cleanSlug.split("/");
  const scanned: string[] = [];

  // List all surahs
  if (parts.length === 1) {
    const surahs = getAllSurah();
    const url = `${BASE_URL}/${locale}/quran`;
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
      const url = `${BASE_URL}/${locale}/quran/${surahNumber}`;

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

async function handleExercisesContent({
  cleanSlug,
  locale,
}: {
  cleanSlug: string;
  locale: Locale;
}): Promise<Response | null> {
  const parts = cleanSlug.split("/");
  let exerciseNumber: number | null = null;
  let path = cleanSlug;

  // Check if last part is a number (specific exercise request)
  const lastPart = parts.at(-1);
  if (lastPart) {
    const parsedNumber = Number.parseInt(lastPart, 10);
    if (!Number.isNaN(parsedNumber)) {
      exerciseNumber = parsedNumber;
      path = parts.slice(0, -1).join("/");
    }
  }

  // Fetch exercises
  const exercises = await getExercisesContent(locale, path);

  if (!exercises || exercises.length === 0) {
    return null;
  }

  // If specific exercise requested, filter it
  let targetExercises = exercises;
  if (exerciseNumber !== null) {
    targetExercises = exercises.filter((ex) => ex.number === exerciseNumber);
    if (targetExercises.length === 0) {
      return null;
    }
  }

  const url = `${BASE_URL}/${locale}/${cleanSlug}`;

  let description = "Exercises Content";
  const pathParts = path.split("/");
  const category = pathParts.at(1);
  const type = pathParts.at(2);
  const material = pathParts.at(3);

  if (category && type && material) {
    const materialPath = getMaterialPath(
      category as ExercisesCategory,
      type as ExercisesType,
      material as ExercisesMaterial
    );
    const materialsList = await getMaterials(materialPath, locale);
    const { currentMaterial, currentMaterialItem } = getCurrentMaterial(
      `/${path}`,
      materialsList
    );

    if (currentMaterial && currentMaterialItem) {
      description = currentMaterial.description
        ? `Exercises: ${currentMaterial.title} - ${currentMaterialItem.title}: ${currentMaterial.description}`
        : `Exercises: ${currentMaterial.title} - ${currentMaterialItem.title}`;
    }
  }

  // If specific exercise, append its info
  if (exerciseNumber !== null) {
    const exerciseTitle = targetExercises[0]?.question.metadata.title;
    if (exerciseTitle) {
      description = `${description} - ${exerciseTitle}`;
    } else {
      description = `${description} - Question ${exerciseNumber}`;
    }
  }

  const scanned: string[] = [];
  scanned.push(
    ...buildHeader({
      url,
      description,
    })
  );

  for (const exercise of targetExercises) {
    scanned.push(`## Exercise ${exercise.number}`);
    scanned.push("");

    // Question
    scanned.push("### Question");
    scanned.push("");
    scanned.push(exercise.question.raw);
    scanned.push("");

    // Choices
    scanned.push("### Choices");
    scanned.push("");
    // Fallback to English if locale specific choices are missing (though schema requires them)
    const choices =
      (locale === "id" ? exercise.choices.id : exercise.choices.en) ||
      exercise.choices.en;

    if (choices) {
      for (const choice of choices) {
        const mark = choice.value ? "x" : " ";
        scanned.push(`- [${mark}] ${choice.label}`);
      }
    }
    scanned.push("");

    // Answer (Explanation)
    scanned.push("### Answer & Explanation");
    scanned.push("");
    scanned.push(exercise.answer.raw);
    scanned.push("");
    scanned.push("---");
    scanned.push("");
  }

  return new Response(scanned.join("\n"));
}

function buildMdxResponse({
  content,
  locale,
  cleanSlug,
}: {
  content: NonNullable<Awaited<ReturnType<typeof getContent>>>;
  locale: Locale;
  cleanSlug: string;
}): Response {
  const url = `${BASE_URL}/${locale}/${cleanSlug}`;
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
