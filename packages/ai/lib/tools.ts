import { api } from "@repo/connection/routes";
import { tool } from "ai";
import * as math from "mathjs";
import * as z from "zod";

export const getContentTool = tool({
  description: "Get the content of a page.",
  inputSchema: z
    .object({
      slug: z.string().describe("The slug of the content to get."),
    })
    .describe("The slug of the content to get."),
  execute: async ({ slug }) => {
    const { data, error } = await api.contents.getContent({ slug });
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

export const mathEvalTool = tool({
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
  execute: ({ expression }) => {
    const node = math.parse(expression);

    const original = {
      expression: node.toString(),
      latex: node.toTex(),
    };

    const simplifiedNode = math.simplify(node);

    let evaluatedValue: string | null;
    try {
      evaluatedValue = simplifiedNode.evaluate();
    } catch {
      evaluatedValue = null;
    }

    const result = {
      expression: simplifiedNode.toString(),
      latex: simplifiedNode.toTex(),
      value:
        evaluatedValue !== null
          ? math.format(evaluatedValue, { precision: 14 })
          : "Cannot be evaluated.",
    };

    return {
      original,
      result,
    };
  },
});
