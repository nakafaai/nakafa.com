import { dedentString } from "@repo/ai/lib/utils";
import { nakafaContent } from "@repo/ai/prompt/content";
import {
  type GetContentOutput,
  getContentInputSchema,
} from "@repo/ai/schema/tools";
import type { MyUIMessage } from "@repo/ai/types/message";
import { api } from "@repo/connection/routes";
import {
  getCurrentMaterial,
  getMaterials,
} from "@repo/contents/_lib/exercises/material";
import type { ExerciseWithoutDefaults } from "@repo/contents/_types/exercises/shared";
import type { Surah } from "@repo/contents/_types/quran";
import { cleanSlug } from "@repo/utilities/helper";
import { tool, type UIMessageStreamWriter } from "ai";
import * as z from "zod";

const QURAN_SLUG_PARTS_COUNT = 2;

interface Params {
  writer: UIMessageStreamWriter<MyUIMessage>;
}

export const createGetContent = ({ writer }: Params) => {
  return tool({
    description: nakafaContent(),
    inputSchema: getContentInputSchema,
    outputSchema: z.string(),
    execute: async ({ slug, locale }, { toolCallId }) => {
      let cleanedSlug = cleanSlug(slug);

      if (cleanedSlug.startsWith(locale)) {
        // Manually make sure that slug not containing locale
        cleanedSlug = cleanedSlug.slice(locale.length + 1); // remove locale and slash
      }

      const url = new URL(
        `/${locale}/${cleanedSlug}`,
        "https://nakafa.com"
      ).toString();

      writer.write({
        id: toolCallId,
        type: "data-get-content",
        data: {
          url,
          title: "",
          description: "",
          status: "loading",
        },
      });

      if (cleanedSlug.startsWith("quran")) {
        const slugParts = cleanedSlug.split("/");

        if (slugParts.length !== QURAN_SLUG_PARTS_COUNT) {
          writer.write({
            id: toolCallId,
            type: "data-get-content",
            data: {
              url,
              title: "",
              description: "",
              status: "error",
              error:
                "Surah not found. Maybe not available or still in development.",
            },
          });

          return createOutput({ output: { url, content: "" } });
        }

        // quran/surah
        const surah = slugParts[1];

        const { data: surahData, error: surahError } =
          await api.contents.getSurah({
            surah: Number.parseInt(surah, 10),
          });

        if (surahError) {
          writer.write({
            id: toolCallId,
            type: "data-get-content",
            data: {
              url,
              title: "",
              description: "",
              status: "error",
              error: surahError.message,
            },
          });

          return createOutput({
            output: { url, content: surahError.message },
          });
        }

        if (!surahData) {
          writer.write({
            id: toolCallId,
            type: "data-get-content",
            data: {
              url,
              title: "",
              description: "",
              status: "error",
              error:
                "Surah not found. Maybe not available or still in development.",
            },
          });

          return createOutput({ output: { url, content: "" } });
        }

        writer.write({
          id: toolCallId,
          type: "data-get-content",
          data: {
            url,
            title: surahData.name.translation[locale] || surahData.name.short,
            description:
              surahData.revelation[locale] || surahData.revelation.arab,
            status: "done",
          },
        });

        return createOutput({
          output: {
            url,
            content: createQuranOutput({
              output: surahData,
              locale,
            }),
          },
        });
      }

      if (cleanedSlug.startsWith("exercises")) {
        const { data: exercisesData, error: exercisesError } =
          await api.contents.getExercises({
            slug: `${locale}/${cleanedSlug}`,
            withRaw: true,
          });

        if (exercisesError) {
          writer.write({
            id: toolCallId,
            type: "data-get-content",
            data: {
              url,
              title: "",
              description: "",
              status: "error",
              error: exercisesError.message,
            },
          });

          return createOutput({
            output: { url, content: exercisesError.message },
          });
        }

        if (!exercisesData || exercisesData.length === 0) {
          writer.write({
            id: toolCallId,
            type: "data-get-content",
            data: {
              url,
              title: "",
              description: "",
              status: "error",
              error:
                "Exercises not found. Maybe not available or still in development.",
            },
          });

          return createOutput({ output: { url, content: "" } });
        }

        const slugParts = cleanedSlug.split("/").filter(Boolean);

        const [, category, type, material] = slugParts;

        const hasRequiredParts = Boolean(category && type && material);

        if (!hasRequiredParts) {
          writer.write({
            id: toolCallId,
            type: "data-get-content",
            data: {
              url,
              title: "",
              description: "",
              status: "error",
              error:
                "Exercises material not found. Maybe not available or still in development.",
            },
          });

          return createOutput({ output: { url, content: "" } });
        }

        const materialPath =
          `/exercises/${category}/${type}/${material}` as const;

        const materials = await getMaterials(materialPath, locale);

        const lastSlug = slugParts.at(-1);
        const filePath =
          lastSlug && isNumericString(lastSlug)
            ? slugParts.slice(0, -1).join("/")
            : cleanedSlug;

        const { currentMaterial, currentMaterialItem } = getCurrentMaterial(
          filePath,
          materials
        );

        writer.write({
          id: toolCallId,
          type: "data-get-content",
          data: {
            url,
            title: currentMaterialItem?.title || "",
            description: currentMaterial?.description || "",
            status: "done",
          },
        });

        return createOutput({
          output: {
            url,
            content: createExercisesOutput({
              output: exercisesData,
              locale,
            }),
          },
        });
      }

      const { data, error } = await api.contents.getContent({
        slug: `${locale}/${cleanedSlug}`,
      });

      if (error) {
        writer.write({
          id: toolCallId,
          type: "data-get-content",
          data: {
            url,
            title: "",
            description: "",
            status: "error",
            error: error.message,
          },
        });

        return createOutput({ output: { url, content: error.message } });
      }

      if (!data) {
        writer.write({
          id: toolCallId,
          type: "data-get-content",
          data: {
            url,
            title: "",
            description: "",
            status: "error",
          },
        });

        return createOutput({ output: { url, content: "" } });
      }

      writer.write({
        id: toolCallId,
        type: "data-get-content",
        data: {
          url,
          title: data.metadata.title,
          description: data.metadata.description || "",
          status: "done",
        },
      });

      return createOutput({ output: { url, content: data.raw } });
    },
  });
};

function createOutput({ output }: { output: GetContentOutput }): string {
  return dedentString(`
    # Source
    - URL: ${output.url}

    # Content
    ${output.content}
  `);
}

function createExercisesOutput({
  output,
  locale,
}: {
  output: ExerciseWithoutDefaults[];
  locale: "en" | "id";
}): string {
  return dedentString(`
    # Exercises
    ${output
      .map(
        (exercise) => `
    ## Exercise ${exercise.number}

    ### Question
    ${exercise.question.raw}

    ### Choices
    ${exercise.choices[locale]
      .map(
        (choice) =>
          `- ${choice.label} (Correct: ${choice.value ? "Yes" : "No"})`
      )
      .join("\n")}

    ### Answer
    ${exercise.answer.raw}`
      )
      .join("\n\n")}
  `);
}

function createQuranOutput({
  output,
  locale,
}: {
  output: Surah;
  locale: "en" | "id";
}): string {
  return dedentString(`
    # Surah ${output.number}

    ## Info
    - Name: ${output.name.transliteration[locale]} (${output.name.translation[locale]})
    - Sequence: ${output.sequence}
    - Total Verses: ${output.numberOfVerses}
    - Revelation: ${output.revelation[locale]}
    ${
      output.preBismillah
        ? `
    ## Pre-Bismillah
    - Arabic: ${output.preBismillah.text.arab}
    - Transliteration: ${output.preBismillah.text.transliteration.en}
    - Translation: ${output.preBismillah.translation[locale]}`
        : ""
    }

    ## Verses
    ${output.verses
      .map(
        (verse) => `
    ### Verse ${verse.number.inSurah}
    - Arabic: ${verse.text.arab}
    - Transliteration: ${verse.text.transliteration.en}
    - Translation: ${verse.translation[locale]}
    ${verse.tafsir.id.short ? `- Tafsir Short: ${verse.tafsir.id.short}` : ""}
    ${verse.tafsir.id.long ? `- Tafsir Long: ${verse.tafsir.id.long}` : ""}`
      )
      .join("\n")}
  `);
}

/**
 * Checks if a string represents a valid integer (only digits).
 */
function isNumericString(str: string): boolean {
  return (
    str.trim() !== "" && Number.parseInt(str, 10).toString() === str.trim()
  );
}
