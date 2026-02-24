import { nakafaArticles } from "@repo/ai/agents/content-access/descriptions";
import {
  type GetArticlesOutput,
  getArticlesInputSchema,
} from "@repo/ai/agents/content-access/schema";
import { buildContentSlug, dedentString } from "@repo/ai/lib/utils";
import type { MyUIMessage } from "@repo/ai/types/message";
import { api } from "@repo/connection/routes";
import { tool, type UIMessageStreamWriter } from "ai";
import * as z from "zod";

interface Params {
  writer: UIMessageStreamWriter<MyUIMessage>;
}

export const createGetArticles = ({ writer }: Params) =>
  tool({
    description: nakafaArticles(),
    inputSchema: getArticlesInputSchema,
    outputSchema: z.string(),
    execute: async ({ locale, category }, { toolCallId }) => {
      const slug = buildContentSlug({
        locale,
        filters: { type: "articles", category },
      });

      const baseUrl = `/${slug}`;

      writer.write({
        id: toolCallId,
        type: "data-get-articles",
        data: {
          baseUrl,
          input: { locale, category },
          status: "loading",
          articles: [],
        },
      });

      const { data, error } = await api.contents.getContents({
        slug,
      });

      if (error) {
        writer.write({
          id: toolCallId,
          type: "data-get-articles",
          data: {
            baseUrl,
            input: { locale, category },
            articles: [],
            status: "error",
            error: error.message,
          },
        });

        return createOutput({ output: { baseUrl, articles: [] } });
      }

      const articles = data.map((item) => ({
        title: item.metadata.title,
        url: item.url,
        slug: item.slug,
        locale: item.locale,
      }));

      writer.write({
        id: toolCallId,
        type: "data-get-articles",
        data: {
          baseUrl,
          input: { locale, category },
          articles,
          status: "done",
        },
      });

      return createOutput({ output: { baseUrl, articles } });
    },
  });

function createOutput({ output }: { output: GetArticlesOutput }): string {
  return dedentString(`
    # Articles List
    - Base URL: ${output.baseUrl}

    ${output.articles
      .map(
        (article, index) => `
    ## Article ${index + 1}
    - Title: ${article.title}
    - URL: ${article.url}
    - Slug: ${article.slug}
    - Locale: ${article.locale}`
      )
      .join("\n")}
  `);
}
