import { api } from "@repo/connection/routes";
import { tool } from "ai";
import { cleanSlug } from "../lib/utils";
import { getContentInputSchema, getContentOutputSchema } from "../schema/tools";

const QURAN_SLUG_PARTS_COUNT = 3;

export const getContentTool = tool({
  name: "getContent",
  description:
    "Fetches the full content from Nakafa platform. CRITICAL: ONLY use this with slugs that were returned from getSubjects or getArticles responses. NEVER use with guessed, assumed, or unverified slugs. Can also retrieve Quran chapters.",
  inputSchema: getContentInputSchema,
  outputSchema: getContentOutputSchema,
  async execute({ slug, locale }) {
    let cleanedSlug = cleanSlug(slug);

    // Manually make sure that slug not containing locale
    if (cleanedSlug.startsWith(locale)) {
      cleanedSlug = cleanedSlug.slice(locale.length + 1); // remove locale and slash
    }

    const url = new URL(`/${locale}/${cleanedSlug}`, "https://nakafa.com");

    if (slug.startsWith("/quran")) {
      const slugParts = slug.split("/");

      if (slugParts.length !== QURAN_SLUG_PARTS_COUNT) {
        return {
          url: url.toString(),
          content:
            "Surah not found. Maybe not available or still in development.",
        };
      }

      const surah = slugParts[2];

      const { data: surahData, error: surahError } =
        await api.contents.getSurah({
          surah: Number.parseInt(surah, 10),
        });

      if (surahError) {
        return {
          url: url.toString(),
          content: surahError.message,
        };
      }

      return {
        url: url.toString(),
        content: JSON.stringify(surahData, null, 2),
      };
    }

    const { data, error } = await api.contents.getContent({
      slug: `${locale}/${cleanedSlug}`,
    });

    if (error) {
      return {
        url: url.toString(),
        content: error.message,
      };
    }

    return {
      url: url.toString(),
      content: data,
    };
  },
});
