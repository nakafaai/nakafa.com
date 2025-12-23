import { buildContentSlug, dedentString } from "@repo/ai/lib/utils";
import { nakafaSubjects } from "@repo/ai/prompt/subjects";
import {
  type GetSubjectsOutput,
  getSubjectsInputSchema,
} from "@repo/ai/schema/tools";
import type { MyUIMessage } from "@repo/ai/types/message";
import { api } from "@repo/connection/routes";
import { tool, type UIMessageStreamWriter } from "ai";
import * as z from "zod";

interface Params {
  writer: UIMessageStreamWriter<MyUIMessage>;
}

export const createGetSubjects = ({ writer }: Params) =>
  tool({
    description: nakafaSubjects(),
    inputSchema: getSubjectsInputSchema,
    outputSchema: z.string(),
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
          input: { locale, category, grade, material },
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
            input: { locale, category, grade, material },
            subjects: [],
            status: "error",
            error: error.message,
          },
        });

        return createOutput({ output: { baseUrl, subjects: [] } });
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
          input: { locale, category, grade, material },
          subjects,
          status: "done",
        },
      });

      return createOutput({ output: { baseUrl, subjects } });
    },
  });

function createOutput({ output }: { output: GetSubjectsOutput }): string {
  return dedentString(`
    # Subjects List
    - Base URL: ${output.baseUrl}

    ${output.subjects
      .map(
        (subject, index) => `
    ## Subject ${index + 1}
    - Title: ${subject.title}
    - URL: ${subject.url}
    - Slug: ${subject.slug}
    - Locale: ${subject.locale}`
      )
      .join("\n")}
  `);
}
