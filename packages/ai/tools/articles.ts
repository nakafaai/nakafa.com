import { buildContentSlug, dedentString } from "@repo/ai/lib/utils";
import { nakafaArticles } from "@repo/ai/prompt/articles";
import {
  type GetArticlesOutput,
  getArticlesInputSchema,
} from "@repo/ai/schema/tools";
import type { MyUIMessage } from "@repo/ai/types/message";
import { api } from "@repo/connection/routes";
import { tool, type UIMessageStreamWriter } from "ai";
import * as z from "zod";

type Params = {
  writer: UIMessageStreamWriter<MyUIMessage>;
};

export const createGetArticles = ({ writer }: Params) =>
  tool({
    name: "getArticles",
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
    <getArticlesOutput>
      <baseUrl>${output.baseUrl}</baseUrl>
      <articles>
        ${output.articles
          .map(
            (article, index) => `
          <article index="${index}">
            <title>${article.title}</title>
            <url>${article.url}</url>
            <slug>${article.slug}</slug>
            <locale>${article.locale}</locale>
          </article>
        `
          )
          .join("")}
      </articles>
    </getArticlesOutput>
  `);
}
