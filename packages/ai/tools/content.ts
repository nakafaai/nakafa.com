import { api } from "@repo/connection/routes";
import { tool, type UIMessageStreamWriter } from "ai";
import { cleanSlug } from "../lib/utils";
import { getContentInputSchema } from "../schema/tools";
import type { MyUIMessage } from "../types/message";

const QURAN_SLUG_PARTS_COUNT = 3;

type Params = {
  writer: UIMessageStreamWriter<MyUIMessage>;
};

export const createGetContent = ({ writer }: Params) => {
  return tool({
    name: "getContent",
    description:
      "Fetches the full content from Nakafa platform. CRITICAL: ONLY use this with slugs that were returned from getSubjects or getArticles responses. NEVER use with guessed, assumed, or unverified slugs. Can also retrieve Quran chapters.",
    inputSchema: getContentInputSchema,
    execute: async ({ slug, locale }) => {
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
        type: "data-get-content",
        data: {
          url,
          status: "loading",
          content: "",
        },
      });

      if (slug.startsWith("/quran")) {
        const slugParts = slug.split("/");

        if (slugParts.length !== QURAN_SLUG_PARTS_COUNT) {
          writer.write({
            type: "data-get-content",
            data: {
              url,
              status: "error",
              content: "",
              error: {
                message:
                  "Surah not found. Maybe not available or still in development.",
              },
            },
          });

          return {
            url,
            content: "",
          };
        }

        const surah = slugParts[2];

        const { data: surahData, error: surahError } =
          await api.contents.getSurah({
            surah: Number.parseInt(surah, 10),
          });

        if (surahError) {
          writer.write({
            type: "data-get-content",
            data: {
              url,
              status: "error",
              content: "",
              error: surahError,
            },
          });

          return {
            url,
            content: surahError.message,
          };
        }

        writer.write({
          type: "data-get-content",
          data: {
            url,
            status: "done",
            content: JSON.stringify(surahData, null, 2),
          },
        });

        return {
          url,
          content: JSON.stringify(surahData, null, 2),
        };
      }

      const { data, error } = await api.contents.getContent({
        slug: `${locale}/${cleanedSlug}`,
      });

      if (error) {
        writer.write({
          type: "data-get-content",
          data: {
            url,
            status: "error",
            content: "",
            error,
          },
        });

        return {
          url,
          content: error.message,
        };
      }

      writer.write({
        type: "data-get-content",
        data: {
          url,
          status: "done",
          content: data,
        },
      });

      return {
        url,
        content: data,
      };
    },
  });
};
