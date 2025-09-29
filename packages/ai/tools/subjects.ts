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

type Params = {
  writer: UIMessageStreamWriter<MyUIMessage>;
};

export const createGetSubjects = ({ writer }: Params) =>
  tool({
    name: "getSubjects",
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
          subjects,
          status: "done",
        },
      });

      return createOutput({ output: { baseUrl, subjects } });
    },
  });

function createOutput({ output }: { output: GetSubjectsOutput }): string {
  return dedentString(`
    <getSubjectsOutput>
      <baseUrl>${output.baseUrl}</baseUrl>
      <subjects>
        ${output.subjects
          .map(
            (subject, index) => `
          <subject index="${index}">
            <title>${subject.title}</title>
            <url>${subject.url}</url>
            <slug>${subject.slug}</slug>
            <locale>${subject.locale}</locale>
          </subject>
        `
          )
          .join("")}
      </subjects>
    </getSubjectsOutput>
  `);
}
