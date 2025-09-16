import { api } from "@repo/connection/routes";
import { tool, type UIMessageStreamWriter } from "ai";
import { buildContentSlug } from "../lib/utils";
import { nakafaArticles } from "../prompt/articles";
import { getArticlesInputSchema } from "../schema/tools";
import type { MyUIMessage } from "../types/message";

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
