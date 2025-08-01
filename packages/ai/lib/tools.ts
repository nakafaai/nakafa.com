import { api } from "@repo/connection/routes";
import { tool } from "ai";
import * as math from "mathjs";
import {
  getContentInputSchema,
  getContentOutputSchema,
  mathEvalInputSchema,
  mathEvalOutputSchema,
} from "../schema/tools";

const getContentTool = tool({
  description: "Get the content of a page.",
  inputSchema: getContentInputSchema,
  outputSchema: getContentOutputSchema,
  execute: async ({ slug, locale }) => {
    if (slug.startsWith("/quran")) {
      const slugParts = slug.split("/");
      if (slugParts.length !== 3) {
        return {
          slug,
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
          slug,
          content: surahError.message,
        };
      }
      return {
        slug,
        content: JSON.stringify(surahData, null, 2),
      };
    }

    const { data, error } = await api.contents.getContent({
      slug: `${locale}${slug}`,
    });

    if (error) {
      return {
        slug,
        content: error.message,
      };
    }
    return {
      slug,
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
  mathEval: mathEvalTool,
};
