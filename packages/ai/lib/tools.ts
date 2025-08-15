import { api } from "@repo/connection/routes";
import { tool } from "ai";
import * as math from "mathjs";
import {
  getContentInputSchema,
  getContentOutputSchema,
  getContentsInputSchema,
  getContentsOutputSchema,
  mathEvalInputSchema,
  mathEvalOutputSchema,
} from "../schema/tools";
import { buildContentSlug, cleanSlug } from "./utils";

const QURAN_SLUG_PARTS_COUNT = 3;

const getContentsTool = tool({
  description:
    "Retrieves a list of available educational content, such as articles or subjects. Results can be filtered by language, subject, grade, or category to narrow down the search.",
  inputSchema: getContentsInputSchema,
  outputSchema: getContentsOutputSchema,
  async execute({ locale, filters }) {
    const slug = buildContentSlug({ locale, filters });

    const { data, error } = await api.contents.getContents({
      slug,
    });

    if (error) {
      return {
        contents: [],
      };
    }

    const contents = data.map((item) => ({
      title: item.metadata.title,
      slug: item.slug,
      locale: item.locale,
    }));

    return {
      contents,
    };
  },
});

const getContentTool = tool({
  description:
    "Fetches the full content of a specific educational page or article from Nakafa. It can also retrieve specific chapters (surah) from the Quran.",
  inputSchema: getContentInputSchema,
  outputSchema: getContentOutputSchema,
  async execute({ slug, locale }) {
    let cleanedSlug = cleanSlug(slug);

    // Manually make sure that slug not containing locale
    if (cleanedSlug.startsWith(`/${locale}`)) {
      cleanedSlug = cleanedSlug.slice(locale.length + 1);
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

const mathEvalTool = tool({
  description:
    "Performs mathematical calculations by evaluating a given mathematical expression. It returns the result in various formats, including the simplified expression and its LaTeX representation.",
  inputSchema: mathEvalInputSchema,
  outputSchema: mathEvalOutputSchema,
  execute: ({ expression }) => {
    const node = math.parse(expression);
    const original = {
      expression: node.toString(),
      latex: node.toTex(),
    };

    const result = {
      expression: "",
      latex: "",
      value: "",
    };

    try {
      const evaluatedValue = node.evaluate();
      const formattedValue = math.format(evaluatedValue, { precision: 14 });

      let latex = formattedValue;
      if (typeof evaluatedValue?.toTex === "function") {
        latex = evaluatedValue.toTex();
      }

      result.expression = formattedValue;
      result.latex = latex;
      result.value = formattedValue;
    } catch {
      result.expression = node.toString();
      result.latex = node.toTex();
      result.value = "Cannot be evaluated.";
    }

    return {
      original,
      result,
    };
  },
});

export const tools = {
  getContent: getContentTool,
  getContents: getContentsTool,
  mathEval: mathEvalTool,
};
