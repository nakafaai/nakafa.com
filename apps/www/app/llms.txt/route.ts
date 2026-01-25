import { getContents } from "@repo/contents/_lib/content";
import {
  getMaterialPath,
  getMaterials,
} from "@repo/contents/_lib/exercises/material";
import { getFolderChildNames } from "@repo/contents/_lib/fs";
import { getAllSurah, getSurahName } from "@repo/contents/_lib/quran";
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

const BASE_URL = "https://nakafa.com";

export const revalidate = false;

export async function GET() {
  const locales = routing.locales;
  const scanned: string[] = [];

  scanned.push("# Nakafa Framework: LLM");
  scanned.push(`URL: ${BASE_URL}/llms.txt`);
  scanned.push("Complete list of all content available on Nakafa.");
  scanned.push("---");

  // Fetch all articles and subjects for all locales in parallel
  const contentPromises = locales.flatMap((locale) => [
    Effect.runPromise(getContents({ locale, basePath: "articles" })).then(
      (contents) => ({
        section: "Articles",
        locale,
        contents,
      })
    ),
    Effect.runPromise(getContents({ locale, basePath: "subject" })).then(
      (contents) => ({
        section: "Subjects",
        locale,
        contents,
      })
    ),
  ]);

  const results = await Promise.all(contentPromises);

  // Group results by section
  const map = new Map<string, string[]>();

  for (const result of results) {
    for (const content of result.contents) {
      if (!content) {
        continue;
      }

      const entry = `- [${content.metadata.title}](${content.url}): ${
        content.metadata.description ?? content.metadata.title
      }`;

      const list = map.get(result.section) ?? [];
      list.push(entry);
      map.set(result.section, list);
    }
  }

  // Handle Exercises
  const exercisesList: string[] = [];
  const exerciseMaterials = getAllExerciseMaterials();

  for (const locale of locales) {
    for (const { category, type, material } of exerciseMaterials) {
      const materialPath = getMaterialPath(category, type, material);
      const materialsList = await getMaterials(materialPath, locale);

      const context = `${category}/${type}/${material}`;

      for (const group of materialsList) {
        for (const item of group.items) {
          const href = item.href.startsWith("/") ? item.href : `/${item.href}`;
          const url = `${BASE_URL}/${locale}${href}`;
          const title = `${group.title} - ${item.title} (${context})`;
          const description = group.description ?? group.title;
          exercisesList.push(`- [${title}](${url}): ${description}`);
        }
      }
    }
  }

  if (exercisesList.length > 0) {
    map.set("Exercises", exercisesList);
  }

  // Build final output
  for (const [key, value] of map) {
    scanned.push(`## ${key}`);
    scanned.push(value.join("\n"));
  }

  // Add Quran section
  scanned.push("## Quran");
  const surahs = getAllSurah();
  const quranEntries: string[] = [];

  for (const locale of locales) {
    for (const surah of surahs) {
      const title = getSurahName({ locale, name: surah.name });
      const translation =
        surah.name.translation[locale] || surah.name.translation.en;
      quranEntries.push(
        `- [${surah.number}. ${title}](${BASE_URL}/${locale}/quran/${surah.number}): ${translation}`
      );
    }
  }

  scanned.push(quranEntries.join("\n"));

  return new Response(scanned.join("\n\n"));
}

function getAllExerciseMaterials(): {
  category: ExercisesCategory;
  type: ExercisesType;
  material: ExercisesMaterial;
}[] {
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
