import { cleanSlug, dedentString } from "@repo/ai/lib/utils";
import { nakafaContent } from "@repo/ai/prompt/content";
import {
  type GetContentOutput,
  getContentInputSchema,
} from "@repo/ai/schema/tools";
import type { MyUIMessage } from "@repo/ai/types/message";
import { api } from "@repo/connection/routes";
import { tool, type UIMessageStreamWriter } from "ai";
import * as z from "zod";

const QURAN_SLUG_PARTS_COUNT = 2;

type Params = {
  writer: UIMessageStreamWriter<MyUIMessage>;
};

export const createGetContent = ({ writer }: Params) => {
  return tool({
    name: "getContent",
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
        "https://nakafa.com",
      ).toString();

      writer.write({
        id: toolCallId,
        type: "data-get-content",
        data: {
          url,
          title: "",
          description: "",
          status: "loading",
          content: "",
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
              content: "",
              error: {
                message:
                  "Surah not found. Maybe not available or still in development.",
              },
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
              content: "",
              error: surahError,
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
              content: "",
              error: {
                message:
                  "Surah not found. Maybe not available or still in development.",
              },
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
            content: JSON.stringify(surahData, null, 2),
          },
        });

        return createOutput({
          output: { url, content: JSON.stringify(surahData, null, 2) },
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
            content: "",
            error,
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
            content: "",
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
          content: data.raw,
        },
      });

      return createOutput({ output: { url, content: data.raw } });
    },
  });
};

function createOutput({ output }: { output: GetContentOutput }): string {
  return dedentString(`
    <getContentOutput>
      <url>${output.url}</url>
      <content>${output.content}</content>
    </getContentOutput>
  `);
}
