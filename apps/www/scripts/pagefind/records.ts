import { getContent } from "@repo/contents/_lib/content";
import {
  getCurrentMaterial,
  getMaterials as getExerciseMaterials,
} from "@repo/contents/_lib/exercises/material";
import { getExercisesContent } from "@repo/contents/_lib/exercises/set";
import { getContentIndexManifest } from "@repo/contents/_lib/manifest/cache/route-params";
import { getAllSurah, getSurah, getSurahName } from "@repo/contents/_lib/quran";
import { LocaleSchema } from "@repo/contents/_types/content";
import type { ExercisesMaterialList } from "@repo/contents/_types/exercises/material";
import { routing } from "@repo/internationalization/src/routing";
import { Effect, Schema } from "effect";
import type { CustomRecord, HTMLFile, PagefindIndex } from "pagefind";
import {
  countWords,
  escapeHtml,
  extractMdxText,
  renderMdxHtml,
} from "@/scripts/pagefind/mdx";

/**
 * Indexes article leaf pages from MDX source while preserving heading structure.
 */
export async function addArticleRecords(index: PagefindIndex) {
  const entries = (
    await Promise.all(
      getContentIndexManifest().indexedArticleEntries.map(
        async ({ locale: rawLocale, slug }) => {
          const locale = Schema.decodeUnknownSync(LocaleSchema)(rawLocale);
          const content = await Effect.runPromise(
            getContent(locale, slug, { includeMDX: false })
          );
          const recordContent = [
            content.metadata.title,
            content.metadata.description ?? "",
            extractMdxText(content.raw),
          ].join("\n\n");

          return {
            file: buildHtmlFile({
              url: `/${locale}/${slug}`,
              locale,
              title: content.metadata.title,
              description: content.metadata.description,
              body: renderMdxHtml(content.raw),
            }),
            words: countWords(recordContent),
          };
        }
      )
    )
  ).flat();

  return addHtmlFiles(index, entries);
}

/**
 * Indexes subject leaf pages from MDX source while preserving heading structure.
 */
export async function addSubjectRecords(index: PagefindIndex) {
  const entries = (
    await Promise.all(
      getContentIndexManifest().indexedSubjectEntries.map(
        async ({ locale: rawLocale, slug }) => {
          const locale = Schema.decodeUnknownSync(LocaleSchema)(rawLocale);
          const content = await Effect.runPromise(
            getContent(locale, slug, { includeMDX: false })
          );
          const recordContent = [
            content.metadata.title,
            content.metadata.subject ?? "",
            content.metadata.description ?? "",
            extractMdxText(content.raw),
          ].join("\n\n");

          return {
            file: buildHtmlFile({
              url: `/${locale}/${slug}`,
              locale,
              title: content.metadata.title,
              description:
                content.metadata.description ?? content.metadata.subject,
              body: renderMdxHtml(content.raw),
            }),
            words: countWords(recordContent),
          };
        }
      )
    )
  ).flat();

  return addHtmlFiles(index, entries);
}

/**
 * Indexes exercise set pages from assembled source records.
 *
 * The exercise search corpus intentionally keeps:
 * - question titles
 * - question bodies
 * - answer explanations
 *
 * We intentionally exclude choice labels because they are low-signal text for
 * search relevance and tend to add noise without adding much retrieval value.
 */
export async function addExerciseRecords(index: PagefindIndex) {
  const materialListCache = new Map<string, Promise<ExercisesMaterialList>>();

  const records = (
    await Promise.all(
      getContentIndexManifest().indexedExerciseSetEntries.map(
        async ({ locale: rawLocale, slug: setPath }) => {
          const locale = Schema.decodeUnknownSync(LocaleSchema)(rawLocale);
          const exercises = await Effect.runPromise(
            getExercisesContent({
              filePath: setPath,
              includeMDX: false,
              locale,
            })
          );

          if (exercises.length === 0) {
            return null;
          }

          const segments = setPath.split("/");
          const materialPath = `/${segments.slice(0, 4).join("/")}`;
          const materialCacheKey = `${locale}:${materialPath}`;
          let materialList = materialListCache.get(materialCacheKey);

          if (!materialList) {
            materialList = Effect.runPromise(
              getExerciseMaterials(materialPath, locale)
            );
            materialListCache.set(materialCacheKey, materialList);
          }

          const materials = await materialList;
          const { currentMaterial, currentMaterialItem } = getCurrentMaterial(
            `/${setPath}`,
            materials
          );
          const title =
            currentMaterialItem?.title ??
            currentMaterial?.title ??
            segments.at(-1);

          if (!title) {
            return null;
          }

          return {
            url: `/${locale}/${setPath}`,
            language: locale,
            meta: { title },
            content: [
              title,
              ...exercises.flatMap((exercise) => [
                exercise.question.metadata.title,
                extractMdxText(exercise.question.raw),
                extractMdxText(exercise.answer.raw),
              ]),
            ].join("\n\n"),
          };
        }
      )
    )
  ).filter((record) => record !== null);

  return addRecords(index, records);
}

/**
 * Indexes Quran surah pages from the Quran dataset.
 */
export async function addQuranRecords(index: PagefindIndex) {
  const records = (
    await Promise.all(
      routing.locales.map((locale) =>
        Promise.all(
          getAllSurah().map(async ({ number }) => {
            const surah = await Effect.runPromise(getSurah(number));
            const title = getSurahName({ locale, name: surah.name });
            const translation =
              surah.name.translation[locale] ?? surah.name.translation.en;
            const body = surah.verses
              .map((verse) => verse.translation[locale] ?? verse.translation.en)
              .join("\n");

            return {
              url: `/${locale}/quran/${surah.number}`,
              language: locale,
              meta: { title },
              content: `${title}\n\n${translation}\n\n${body}`,
            };
          })
        )
      )
    )
  ).flat(2);

  return addRecords(index, records);
}

/**
 * Adds custom records to Pagefind and returns aggregate stats.
 */
async function addRecords(index: PagefindIndex, records: CustomRecord[]) {
  let count = 0;
  let words = 0;

  for (const record of records) {
    if (!record.content) {
      continue;
    }

    const result = await index.addCustomRecord(record);

    if (result.errors.length > 0) {
      throw new Error(result.errors.join("\n"));
    }

    count += 1;
    words += countWords(record.content);
  }

  return { count, words };
}

/**
 * Adds semantic HTML files to Pagefind and returns aggregate stats.
 */
async function addHtmlFiles(
  index: PagefindIndex,
  entries: Array<{ file: HTMLFile; words: number }>
) {
  let count = 0;
  let words = 0;

  for (const entry of entries) {
    if (!entry.file.content) {
      continue;
    }

    const result = await index.addHTMLFile(entry.file);

    if (result.errors.length > 0) {
      throw new Error(result.errors.join("\n"));
    }

    count += 1;
    words += entry.words;
  }

  return { count, words };
}

/**
 * Builds one semantic HTML file for Pagefind from source content.
 */
function buildHtmlFile({
  url,
  locale,
  title,
  description,
  body,
}: {
  url: string;
  locale: (typeof routing.locales)[number];
  title: string;
  description?: string;
  body: string;
}) {
  const escapedTitle = escapeHtml(title);

  return {
    url,
    content: [
      "<!doctype html>",
      `<html lang="${locale}">`,
      "<head>",
      `<title>${escapedTitle}</title>`,
      "</head>",
      "<body>",
      "<article data-pagefind-body>",
      `<h1>${escapedTitle}</h1>`,
      description ? `<p>${escapeHtml(description)}</p>` : "",
      body,
      "</article>",
      "</body>",
      "</html>",
    ].join(""),
  };
}
