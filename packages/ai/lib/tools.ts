import { api } from "@repo/connection/routes";
import { tool } from "ai";
import * as math from "mathjs";
import * as z from "zod";

const getContentTool = tool({
  description: "Get the content of a page.",
  inputSchema: z
    .object({
      locale: z
        .enum(["en", "id"])
        .describe("The locale of the content to get."),
      slug: z
        .string()
        .describe(
          "The slug of the content to get. Always start with slash (/)."
        ),
    })
    .describe("The slug of the content to get."),
  outputSchema: z.object({
    slug: z.string().describe("The slug of the content to get."),
    content: z.string().describe("The content of the page."),
  }),
  execute: async ({ slug, locale }) => {
    if (slug.includes("/quran")) {
      if (slug.split("/").length !== 2) {
        return {
          slug,
          content: "Surah not found.",
        };
      }

      const surah = slug.split("/")[1];

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
      slug: `${locale}/${slug}`,
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
  inputSchema: z
    .object({
      expression: z
        .string()
        .describe(
          "Valid math expression to evaluate. It will use math.js to evaluate the expression."
        ),
    })
    .describe("Expression to evaluate using math.js."),
  outputSchema: z.object({
    original: z.object({
      expression: z.string().describe("The original expression."),
      latex: z.string().describe("The original expression in LaTeX."),
    }),
    result: z.object({
      expression: z.string().describe("The simplified expression."),
      latex: z.string().describe("The simplified expression in LaTeX."),
      value: z.string().describe("The evaluated value."),
    }),
  }),
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
