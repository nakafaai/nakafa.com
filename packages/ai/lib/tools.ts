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
import { buildContentSlug } from "./utils";

const getContentsTool = tool({
  description: "Get a list of contents available in Nakafa.",
  inputSchema: getContentsInputSchema,
  outputSchema: getContentsOutputSchema,
  execute: async ({ locale, filters }) => {
    const cleanSlug = buildContentSlug({ locale, filters });

    const { data, error } = await api.contents.getContents({
      slug: cleanSlug,
    });

    if (error) {
      return {
        content: [],
      };
    }

    return {
      content: data.map((item) => ({
        title: item.metadata.title,
        url: item.url,
        slug: item.slug,
      })),
    };
  },
});

const getContentTool = tool({
  description: "Get the content of a page in Nakafa.",
  inputSchema: getContentInputSchema,
  outputSchema: getContentOutputSchema,
  execute: async ({ slug, locale }) => {
    const url = new URL(`/${locale}${slug}`, "https://nakafa.com");

    if (slug.startsWith("/quran")) {
      const slugParts = slug.split("/");
      if (slugParts.length !== 3) {
        return {
          url: url.toString(),
          content: "Surah not found.",
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
      slug: `${locale}${slug}`,
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
  description: "Evaluate a math expression.",
  inputSchema: mathEvalInputSchema,
  outputSchema: mathEvalOutputSchema,
  execute: ({ expression }) => {
    const node = math.parse(expression);
    const original = {
      expression: node.toString(),
      latex: node.toTex(),
    };

    const simplifiedNode = math.simplify(node);

    const result = {
      expression: "",
      latex: "",
      value: "",
    };

    try {
      const evaluatedValue = simplifiedNode.evaluate();
      const formattedValue = math.format(evaluatedValue, { precision: 14 });

      let latex = formattedValue;
      if (typeof evaluatedValue?.toTex === "function") {
        latex = evaluatedValue.toTex();
      }

      result.expression = formattedValue;
      result.latex = latex;
      result.value = formattedValue;
    } catch {
      result.expression = simplifiedNode.toString();
      result.latex = simplifiedNode.toTex();
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
