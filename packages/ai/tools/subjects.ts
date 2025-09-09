import { api } from "@repo/connection/routes";
import { tool, type UIMessageStreamWriter } from "ai";
import { buildContentSlug } from "../lib/utils";
import { getSubjectsInputSchema } from "../schema/tools";
import type { MyUIMessage } from "../types/message";

type Params = {
  writer: UIMessageStreamWriter<MyUIMessage>;
};

export const createGetSubjects = ({ writer }: Params) => {
  return tool({
    name: "getSubjects",
    description:
      "Retrieves educational subjects from Nakafa platform - structured learning materials and curricula from K-12 through university level. Use this for study questions, homework help, learning concepts, educational content, and curriculum-based topics.",
    inputSchema: getSubjectsInputSchema,
    execute: async ({ locale, category, grade, material }, { toolCallId }) => {
      const slug = buildContentSlug({
        locale,
        filters: { type: "subject", category, grade, material },
      });

      const baseUrl = `/${slug}`;

      writer.write({
        id: toolCallId,
        type: "data-get-subjects",
        data: {
          baseUrl,
          status: "loading",
          subjects: [],
        },
      });

      const { data, error } = await api.contents.getContents({
        slug,
      });

      if (error) {
        writer.write({
          id: toolCallId,
          type: "data-get-subjects",
          data: {
            baseUrl,
            subjects: [],
            status: "error",
            error,
          },
        });

        return {
          baseUrl,
          subjects: [],
        };
      }

      const subjects = data.map((item) => ({
        title: item.metadata.title,
        url: item.url,
        slug: item.slug,
        locale: item.locale,
      }));

      writer.write({
        id: toolCallId,
        type: "data-get-subjects",
        data: {
          baseUrl,
          subjects,
          status: "done",
        },
      });

      return {
        baseUrl,
        subjects,
      };
    },
  });
};
