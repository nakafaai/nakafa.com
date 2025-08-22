import { api } from "@repo/connection/routes";
import { tool } from "ai";
import { buildContentSlug } from "../lib/utils";
import {
  getArticlesInputSchema,
  getArticlesOutputSchema,
} from "../schema/tools";

export const getArticlesTool = tool({
  name: "getArticles",
  description:
    "Retrieves articles from Nakafa platform - includes scientific journals, research papers, internet articles, news, analysis, politics, and general publications. Use this for research questions, current events, scientific studies, news analysis, and academic research topics.",
  inputSchema: getArticlesInputSchema,
  outputSchema: getArticlesOutputSchema,
  async execute({ locale, category }) {
    const slug = buildContentSlug({
      locale,
      filters: { type: "articles", category },
    });

    const baseUrl = `/${slug}`;

    const { data, error } = await api.contents.getContents({
      slug,
    });

    if (error) {
      return {
        baseUrl,
        articles: [],
      };
    }

    const articles = data.map((item) => ({
      title: item.metadata.title,
      url: item.url,
      slug: item.slug,
      locale: item.locale,
    }));

    return {
      baseUrl,
      articles,
    };
  },
});
