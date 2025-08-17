import { api } from "@repo/connection/routes";
import { tool } from "ai";
import * as math from "mathjs";
import {
  calculatorInputSchema,
  calculatorOutputSchema,
  getArticlesInputSchema,
  getArticlesOutputSchema,
  getContentInputSchema,
  getContentOutputSchema,
  getSubjectsInputSchema,
  getSubjectsOutputSchema,
} from "../schema/tools";
import { buildContentSlug, cleanSlug } from "./utils";

const QURAN_SLUG_PARTS_COUNT = 3;

const getArticlesTool = tool({
  name: "getArticles",
  description:
    "Retrieves articles from Nakafa platform - includes scientific journals, research papers, internet articles, news, analysis, and general publications. Use this for ANY question about ANY topic.",
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
  name: "getSubjects",
  description:
    "Retrieves educational subjects from Nakafa platform - structured learning materials and curricula from K-12 through university level. Use this for ANY question about ANY topic.",
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
  name: "getContent",
  description:
    "Fetches the full content from Nakafa platform. CRITICAL: ONLY use this with slugs that were returned from getSubjects or getArticles responses. NEVER use with guessed, assumed, or unverified slugs. Can also retrieve Quran chapters.",
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
  name: "calculator",
  description:
    "MANDATORY calculator tool - ALWAYS use this for ANY mathematical calculation including simple arithmetic. NEVER calculate manually. Only use for evaluable expressions with concrete numbers, not algebraic variables. Uses Math.js to evaluate expressions.",
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
  getContent: getContentTool,
  getArticles: getArticlesTool,
  getSubjects: getSubjectsTool,
  calculator: calculatorTool,
};
