import {
  getCurrentMaterial,
  getMaterialPath,
  getMaterials,
} from "@repo/contents/_lib/exercises/material";
import { getExercisesContent } from "@repo/contents/_lib/exercises/set";
import { getFolderChildNames } from "@repo/contents/_lib/fs";
import {
  getContentMetadataWithRaw,
  getContentsMetadata,
} from "@repo/contents/_lib/metadata";
import { getAllSurah, getSurah, getSurahName } from "@repo/contents/_lib/quran";
import {
  type ExercisesCategory,
  ExercisesCategorySchema,
} from "@repo/contents/_types/exercises/category";
import {
  type ExercisesMaterial,
  ExercisesMaterialSchema,
} from "@repo/contents/_types/exercises/material";
import {
  type ExercisesType,
  ExercisesTypeSchema,
} from "@repo/contents/_types/exercises/type";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import { cacheLife } from "next/cache";
import type { Locale } from "next-intl";
import { getRawGithubUrl } from "@/lib/utils/github";

const BASE_URL = "https://nakafa.com";

function buildHeader({
  url,
  description,
  source,
}: {
  url: string;
  description: string;
  source?: string;
}) {
  const header = ["# Nakafa Framework: LLM", "", `URL: ${url}`];

  if (source) {
    header.push(`Source: ${source}`);
  }

  header.push("", description, "", "---", "");

  return header;
}

function getTranslation(translations: Record<Locale, string>, locale: Locale) {
  return translations[locale] || translations.en;
}

function getAllExerciseMaterials() {
  const root = "exercises";
  const categories = Effect.runSync(
    Effect.match(getFolderChildNames(root), {
      onFailure: () => [],
      onSuccess: (names) => names,
    })
  );
  const result: {
    category: ExercisesCategory;
    type: ExercisesType;
    material: ExercisesMaterial;
  }[] = [];

  for (const category of categories) {
    const types = Effect.runSync(
      Effect.match(getFolderChildNames(`${root}/${category}`), {
        onFailure: () => [],
        onSuccess: (names) => names,
      })
    );

    for (const type of types) {
      const materials = Effect.runSync(
        Effect.match(getFolderChildNames(`${root}/${category}/${type}`), {
          onFailure: () => [],
          onSuccess: (names) => names,
        })
      );

      for (const material of materials) {
        const parsedCategory = ExercisesCategorySchema.safeParse(category);
        const parsedType = ExercisesTypeSchema.safeParse(type);
        const parsedMaterial = ExercisesMaterialSchema.safeParse(material);

        if (
          parsedCategory.success &&
          parsedType.success &&
          parsedMaterial.success
        ) {
          result.push({
            category: parsedCategory.data,
            type: parsedType.data,
            material: parsedMaterial.data,
          });
        }
      }
    }
  }

  return result;
}

/** Builds the shared `/llms.txt` index text inside a cache-safe helper. */
export async function getCachedLlmsIndexText() {
  "use cache";

  cacheLife("max");

  const scanned = [
    "# Nakafa Framework: LLM",
    `URL: ${BASE_URL}/llms.txt`,
    "Complete list of all content available on Nakafa.",
    "---",
  ];

  const contentPromises = routing.locales.flatMap((locale) => [
    Effect.runPromise(
      getContentsMetadata({ locale, basePath: "articles" })
    ).then((contents) => ({
      section: "Articles",
      contents,
    })),
    Effect.runPromise(
      getContentsMetadata({ locale, basePath: "subject" })
    ).then((contents) => ({
      section: "Subjects",
      contents,
    })),
  ]);

  const results = await Promise.all(contentPromises);
  const sections = new Map<string, string[]>();

  for (const result of results) {
    for (const content of result.contents) {
      if (!content) {
        continue;
      }

      const entry = `- [${content.metadata.title}](${content.url}): ${
        content.metadata.description ?? content.metadata.title
      }`;
      const list = sections.get(result.section) ?? [];
      list.push(entry);
      sections.set(result.section, list);
    }
  }

  const exerciseMaterials = getAllExerciseMaterials();
  const exerciseLists = await Promise.all(
    routing.locales.flatMap((locale) =>
      exerciseMaterials.map(async ({ category, type, material }) => {
        const materialPath = getMaterialPath(category, type, material);
        const materialsList = await getMaterials(materialPath, locale);
        const context = `${category}/${type}/${material}`;

        return materialsList.flatMap((group) =>
          group.items.map((item) => {
            const href = item.href.startsWith("/")
              ? item.href
              : `/${item.href}`;

            return `- [${group.title} - ${item.title} (${context})](${BASE_URL}/${locale}${href}): ${group.description ?? group.title}`;
          })
        );
      })
    )
  );

  const exercises = exerciseLists.flat();
  if (exercises.length > 0) {
    sections.set("Exercises", exercises);
  }

  for (const [section, entries] of sections) {
    scanned.push(`## ${section}`);
    scanned.push(entries.join("\n"));
  }

  const quranEntries: string[] = [];
  const surahs = getAllSurah();

  for (const locale of routing.locales) {
    for (const surah of surahs) {
      const title = getSurahName({ locale, name: surah.name });
      const translation = getTranslation(surah.name.translation, locale);
      quranEntries.push(
        `- [${surah.number}. ${title}](${BASE_URL}/${locale}/quran/${surah.number}): ${translation}`
      );
    }
  }

  scanned.push("## Quran");
  scanned.push(quranEntries.join("\n"));

  return scanned.join("\n\n");
}

/** Builds the Quran LLM text for one cleaned slug, or returns `null` if it is not a Quran path. */
export function getQuranLlmsText({
  cleanSlug,
  locale,
}: {
  cleanSlug: string;
  locale: Locale;
}) {
  if (!cleanSlug.startsWith("quran")) {
    return null;
  }

  const parts = cleanSlug.split("/");
  const scanned: string[] = [];

  if (parts.length === 1) {
    const surahs = getAllSurah();
    scanned.push(
      ...buildHeader({
        url: `${BASE_URL}/${locale}/quran`,
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

    return scanned.join("\n");
  }

  if (parts.length !== 2) {
    return null;
  }

  const surahNumber = Number(parts[1]);
  if (Number.isNaN(surahNumber)) {
    return null;
  }

  const surah = Effect.runSync(
    Effect.match(getSurah(surahNumber), {
      onFailure: () => null,
      onSuccess: (data) => data,
    })
  );

  if (!surah) {
    return null;
  }

  const title = getSurahName({ locale, name: surah.name });
  const translation = getTranslation(surah.name.translation, locale);
  scanned.push(
    ...buildHeader({
      url: `${BASE_URL}/${locale}/quran/${surahNumber}`,
      description: `Al-Quran - Surah ${title} (${translation})`,
    })
  );
  scanned.push(`## ${title}`);
  scanned.push("");
  scanned.push(`**Translation:** ${translation}`);
  scanned.push(`**Revelation:** ${surah.revelation.en}`);
  scanned.push(`**Number of Verses:** ${surah.numberOfVerses}`);
  scanned.push("");

  if (surah.preBismillah) {
    scanned.push("### Pre-Bismillah");
    scanned.push("");
    scanned.push(surah.preBismillah.text.arab);
    scanned.push("");
    scanned.push(`*${getTranslation(surah.preBismillah.translation, locale)}*`);
    scanned.push("");
  }

  scanned.push("### Verses");
  scanned.push("");

  for (const verse of surah.verses) {
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

  return scanned.join("\n");
}

/** Builds the LLM text for one exercise page or item inside a cache-safe helper. */
export async function getCachedLlmsExerciseText({
  cleanSlug,
  locale,
}: {
  cleanSlug: string;
  locale: Locale;
}) {
  "use cache";

  cacheLife("max");

  if (!cleanSlug.startsWith("exercises")) {
    return null;
  }

  const parts = cleanSlug.split("/");
  let exerciseNumber: number | null = null;
  let path = cleanSlug;
  const lastPart = parts.at(-1);

  if (lastPart) {
    const parsedNumber = Number.parseInt(lastPart, 10);

    if (!Number.isNaN(parsedNumber)) {
      exerciseNumber = parsedNumber;
      path = parts.slice(0, -1).join("/");
    }
  }

  const exercises = await Effect.runPromise(
    Effect.match(
      getExercisesContent({ locale, filePath: path, includeMDX: false }),
      {
        onFailure: () => [],
        onSuccess: (data) => data,
      }
    )
  );

  if (exercises.length === 0) {
    return null;
  }

  const targetExercises =
    exerciseNumber === null
      ? exercises
      : exercises.filter((exercise) => exercise.number === exerciseNumber);

  if (targetExercises.length === 0) {
    return null;
  }

  let description = "Exercises Content";
  const pathParts = path.split("/");
  const category = pathParts.at(1);
  const type = pathParts.at(2);
  const material = pathParts.at(3);
  const parsedCategory = ExercisesCategorySchema.safeParse(category);
  const parsedType = ExercisesTypeSchema.safeParse(type);
  const parsedMaterial = ExercisesMaterialSchema.safeParse(material);

  if (parsedCategory.success && parsedType.success && parsedMaterial.success) {
    const materialPath = getMaterialPath(
      parsedCategory.data,
      parsedType.data,
      parsedMaterial.data
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

  if (exerciseNumber !== null) {
    const exerciseTitle = targetExercises[0]?.question.metadata.title;
    description = exerciseTitle
      ? `${description} - ${exerciseTitle}`
      : `${description} - Question ${exerciseNumber}`;
  }

  const scanned = buildHeader({
    url: `${BASE_URL}/${locale}/${cleanSlug}`,
    description,
  });

  for (const exercise of targetExercises) {
    scanned.push(`## Exercise ${exercise.number}`);
    scanned.push("");
    scanned.push("### Question");
    scanned.push("");
    scanned.push(exercise.question.raw);
    scanned.push("");
    scanned.push("### Choices");
    scanned.push("");

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
    scanned.push("### Answer & Explanation");
    scanned.push("");
    scanned.push(exercise.answer.raw);
    scanned.push("");
    scanned.push("---");
    scanned.push("");
  }

  return scanned.join("\n");
}

/** Builds the LLM text for one MDX content page inside a cache-safe helper. */
export async function getCachedLlmsMdxText({
  cleanSlug,
  locale,
}: {
  cleanSlug: string;
  locale: Locale;
}) {
  "use cache";

  cacheLife("max");

  const content = await Effect.runPromise(
    Effect.match(getContentMetadataWithRaw(locale, cleanSlug), {
      onFailure: () => null,
      onSuccess: (data) => data,
    })
  );

  if (!content) {
    return null;
  }

  const scanned = [
    ...buildHeader({
      url: `${BASE_URL}/${locale}/${cleanSlug}`,
      description: "Output docs content for large language models.",
      source: getRawGithubUrl(`/packages/contents/${cleanSlug}/${locale}.mdx`),
    }),
    content.raw,
  ];

  return scanned.join("\n");
}
