import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import { api } from "@repo/connection/routes";
import { generateObject, tool } from "ai";
import * as math from "mathjs";
import { taskPrompt } from "../prompt/system";
import {
  calculatorInputSchema,
  calculatorOutputSchema,
  createTaskInputSchema,
  createTaskOutputSchema,
  getArticlesInputSchema,
  getArticlesOutputSchema,
  getContentInputSchema,
  getContentOutputSchema,
  getSubjectsInputSchema,
  getSubjectsOutputSchema,
} from "../schema/tools";
import { defaultModel, model } from "./providers";
import { buildContentSlug, cleanSlug } from "./utils";

const QURAN_SLUG_PARTS_COUNT = 3;

const createTaskTool = tool({
  description: "Create a task to help the user learn.",
  inputSchema: createTaskInputSchema,
  outputSchema: createTaskOutputSchema,
  async *execute({ context }) {
    // https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#preliminary-tool-results
    yield {
      tasks: [],
      status: "loading",
    };

    const { object } = await generateObject({
      model: model.languageModel(defaultModel),
      system: taskPrompt({ context }),
      prompt: context,
      schema: createTaskOutputSchema.pick({
        tasks: true,
      }),
      providerOptions: {
        google: {
          thinkingConfig: {
            thinkingBudget: 0, // Disable thinking
            includeThoughts: false,
          },
        } satisfies GoogleGenerativeAIProviderOptions,
      },
    });

    yield {
      tasks: object.tasks,
      status: "completed",
    };
  },
});

const getArticlesTool = tool({
  description: "Retrieves a list of available articles.",
  inputSchema: getArticlesInputSchema,
  outputSchema: getArticlesOutputSchema,
  async execute({ locale, category }) {
    const slug = buildContentSlug({
      locale,
      filters: { type: "articles", category },
    });

    const { data, error } = await api.contents.getContents({
      slug,
    });

    if (error) {
      return {
        articles: [],
      };
    }

    const articles = data.map((item) => ({
      title: item.metadata.title,
      slug: item.slug,
      locale: item.locale,
    }));

    return {
      articles,
    };
  },
});

const getSubjectsTool = tool({
  description: "Retrieves a list of available subjects.",
  inputSchema: getSubjectsInputSchema,
  outputSchema: getSubjectsOutputSchema,
  async execute({ locale, category, grade, material }) {
    const slug = buildContentSlug({
      locale,
      filters: { type: "subject", category, grade, material },
    });

    const { data, error } = await api.contents.getContents({
      slug,
    });

    if (error) {
      return {
        subjects: [],
      };
    }

    const subjects = data.map((item) => ({
      title: item.metadata.title,
      slug: item.slug,
      locale: item.locale,
    }));

    return {
      subjects,
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

const calculatorTool = tool({
  description:
    "Performs mathematical calculations by evaluating a given mathematical expression. It returns the result in various formats, including the simplified expression and its LaTeX representation.",
  inputSchema: calculatorInputSchema,
  outputSchema: calculatorOutputSchema,
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
  createTask: createTaskTool,
  getContent: getContentTool,
  getArticles: getArticlesTool,
  getSubjects: getSubjectsTool,
  calculator: calculatorTool,
};
