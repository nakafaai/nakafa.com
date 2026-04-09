import { rm } from "node:fs/promises";
import { getMDXSlugsForLocale } from "@repo/contents/_lib/cache";
import { getContent } from "@repo/contents/_lib/content";
import { getExercisesContent } from "@repo/contents/_lib/exercises";
import {
  getCurrentMaterial,
  getMaterials as getExerciseMaterials,
} from "@repo/contents/_lib/exercises/material";
import { getSurah, getSurahName } from "@repo/contents/_lib/quran";
import { routing } from "@repo/internationalization/src/routing";
import { askSeo } from "@repo/seo/ask";
import { Effect } from "effect";
import type { CustomRecord, PagefindIndex } from "pagefind";
import { remark } from "remark";
import remarkMdx from "remark-mdx";

const OUTPUT_PATH = "public/_pagefind";
const CONTENT_PREFIXES = ["articles/", "subject/"];
const EXERCISE_SEGMENT = /^(.+)\/\d+\/_question$/;
const WORD_SEPARATOR = /\s+/;
const mdxParser = remark().use(remarkMdx);

/**
 * Builds the production Pagefind bundle from source-of-truth content instead of
 * Next.js PPR HTML shells.
 */
async function main() {
  const { createIndex } = await import("pagefind");

  await rm(OUTPUT_PATH, { force: true, recursive: true });

  const response = await createIndex();

  if (!response.index) {
    throw new Error(
      response.errors.join("\n") || "Failed to create Pagefind index"
    );
  }

  const { index } = response;
  let count = 0;
  let words = 0;

  for (const add of [
    addAskRecords,
    addArticleRecords,
    addSubjectRecords,
    addExerciseRecords,
    addQuranRecords,
  ]) {
    const result = await add(index);
    count += result.count;
    words += result.words;
  }

  const write = await index.writeFiles({ outputPath: OUTPUT_PATH });

  if (write.errors.length > 0) {
    throw new Error(write.errors.join("\n"));
  }

  console.log(
    `Indexed ${count} source records and ${words} words into ${write.outputPath}`
  );
}

/**
 * Indexes SEO landing pages served from the ask dataset.
 */
function addAskRecords(index: PagefindIndex) {
  const records = askSeo().flatMap((entry) =>
    routing.locales.map((locale) => {
      const localized = entry.locales[locale];

      return {
        url: `/${locale}/ask/${entry.slug}`,
        language: locale,
        meta: { title: localized.title },
        content: normalizeText(
          `${localized.title}\n\n${localized.description}`
        ),
      };
    })
  );

  return addRecords(index, records);
}

/**
 * Indexes article leaf pages directly from MDX source.
 */
async function addArticleRecords(index: PagefindIndex) {
  const records = (
    await Promise.all(
      routing.locales.map((locale) => {
        const slugs = getMDXSlugsForLocale(locale).filter((item) =>
          item.startsWith(CONTENT_PREFIXES[0])
        );

        return Promise.all(
          slugs.map(async (slug) => {
            const content = await Effect.runPromise(
              getContent(locale, slug, { includeMDX: false })
            );

            return {
              url: `/${locale}/${slug}`,
              language: locale,
              meta: { title: content.metadata.title },
              content: normalizeText(
                [
                  content.metadata.title,
                  content.metadata.description ?? "",
                  extractMdxText(content.raw),
                ].join("\n\n")
              ),
            };
          })
        );
      })
    )
  ).flat(2);

  return addRecords(index, records);
}

/**
 * Indexes subject leaf pages directly from MDX source.
 */
async function addSubjectRecords(index: PagefindIndex) {
  const records = (
    await Promise.all(
      routing.locales.map((locale) => {
        const slugs = getMDXSlugsForLocale(locale).filter((item) =>
          item.startsWith(CONTENT_PREFIXES[1])
        );

        return Promise.all(
          slugs.map(async (slug) => {
            const content = await Effect.runPromise(
              getContent(locale, slug, { includeMDX: false })
            );

            return {
              url: `/${locale}/${slug}`,
              language: locale,
              meta: { title: content.metadata.title },
              content: normalizeText(
                [
                  content.metadata.title,
                  content.metadata.subject ?? "",
                  content.metadata.description ?? "",
                  extractMdxText(content.raw),
                ].join("\n\n")
              ),
            };
          })
        );
      })
    )
  ).flat(2);

  return addRecords(index, records);
}

/**
 * Indexes exercise set pages from the assembled exercise source.
 */
async function addExerciseRecords(index: PagefindIndex) {
  const records = (
    await Promise.all(
      routing.locales.map((locale) =>
        Promise.all(
          getExerciseSetPaths(locale).map(async (setPath) => {
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
            const materials = await getExerciseMaterials(materialPath, locale);
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
              content: normalizeText(
                exercises
                  .flatMap((exercise) => [
                    exercise.question.metadata.title,
                    extractMdxText(exercise.question.raw),
                    ...exercise.choices[locale].map((choice) => choice.label),
                    extractMdxText(exercise.answer.raw),
                  ])
                  .join("\n\n")
              ),
            };
          })
        )
      )
    )
  )
    .flat(2)
    .filter((record) => record !== null);

  return addRecords(index, records);
}

/**
 * Indexes Quran surah pages from the Quran dataset.
 */
async function addQuranRecords(index: PagefindIndex) {
  const records = (
    await Promise.all(
      routing.locales.map((locale) =>
        Promise.all(
          Array.from({ length: 114 }, (_, index) => index + 1).map(
            async (number) => {
              const surah = await Effect.runPromise(getSurah(number));
              const title = getSurahName({ locale, name: surah.name });
              const translation =
                surah.name.translation[locale] ?? surah.name.translation.en;
              const body = surah.verses
                .map(
                  (verse) => verse.translation[locale] ?? verse.translation.en
                )
                .join("\n");

              return {
                url: `/${locale}/quran/${surah.number}`,
                language: locale,
                meta: { title },
                content: normalizeText(`${title}\n\n${translation}\n\n${body}`),
              };
            }
          )
        )
      )
    )
  ).flat(2);

  return addRecords(index, records);
}

/**
 * Adds records to Pagefind sequentially and returns the count of successful URLs.
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
    words += record.content.split(WORD_SEPARATOR).length;
  }

  return { count, words };
}

/**
 * Extracts unique exercise-set paths from question slugs.
 */
function getExerciseSetPaths(locale: (typeof routing.locales)[number]) {
  const paths = new Set<string>();

  for (const slug of getMDXSlugsForLocale(locale)) {
    const match = slug.match(EXERCISE_SEGMENT);

    if (!match?.[1]) {
      continue;
    }

    paths.add(match[1]);
  }

  return [...paths].sort();
}

/**
 * Converts MDX source into searchable plain text with a remark MDX AST.
 */
function extractMdxText(source: string) {
  const tree = mdxParser.parse(source);

  return normalizeText(readNode(tree));
}

/**
 * Reads text content from a markdown or MDX AST node.
 */
function readNode(node: unknown): string {
  const current = readRecord(node);

  if (!current) {
    return "";
  }

  if ("type" in current) {
    if (
      current.type === "mdxjsEsm" ||
      current.type === "mdxFlowExpression" ||
      current.type === "mdxTextExpression"
    ) {
      return "";
    }

    if ("value" in current && typeof current.value === "string") {
      return current.value;
    }

    if ("alt" in current && typeof current.alt === "string") {
      return current.alt;
    }
  }

  const values = [
    ...(Array.isArray(current.attributes)
      ? current.attributes
          .map(readRecord)
          .filter((attribute) => attribute !== null)
          .flatMap((attribute) =>
            "value" in attribute && typeof attribute.value === "string"
              ? [attribute.value]
              : []
          )
      : []),
    ...(Array.isArray(current.children) ? current.children.map(readNode) : []),
  ];

  return values.join("\n");
}

/**
 * Narrows an unknown value to a plain record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

/**
 * Returns a record value when the input is an object.
 */
function readRecord(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  return value;
}

/**
 * Normalizes arbitrary text into a compact Pagefind record body.
 */
function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
