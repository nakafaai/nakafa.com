import { buildContentSlug } from "@repo/ai/lib/utils";
import { nakafaArticles } from "@repo/ai/prompt/articles";
import { getArticlesInputSchema } from "@repo/ai/schema/tools";
import type { MyUIMessage } from "@repo/ai/types/message";
import { api } from "@repo/connection/routes";
import { tool, type UIMessageStreamWriter } from "ai";

type Params = {
  writer: UIMessageStreamWriter<MyUIMessage>;
};

export const createGetArticles = ({ writer }: Params) => {
  return tool({
    name: "getArticles",
    description: nakafaArticles(),
    inputSchema: getArticlesInputSchema,
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
            articles: [],
            status: "error",
            error,
          },
        });

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

      writer.write({
        id: toolCallId,
        type: "data-get-articles",
        data: {
          baseUrl,
          articles,
          status: "done",
        },
      });

      return {
        baseUrl,
        articles,
      };
    },
  });
};
