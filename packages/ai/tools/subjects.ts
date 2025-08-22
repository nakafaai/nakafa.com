import { api } from "@repo/connection/routes";
import { tool } from "ai";
import { buildContentSlug } from "../lib/utils";
import {
  getSubjectsInputSchema,
  getSubjectsOutputSchema,
} from "../schema/tools";

export const getSubjectsTool = tool({
  name: "getSubjects",
  description:
    "Retrieves educational subjects from Nakafa platform - structured learning materials and curricula from K-12 through university level. Use this for study questions, homework help, learning concepts, educational content, and curriculum-based topics.",
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
      url: item.url,
      slug: item.slug,
      locale: item.locale,
    }));

    return {
      subjects,
    };
  },
});
