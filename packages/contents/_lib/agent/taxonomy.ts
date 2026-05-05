import {
  NAKAFA_AGENT_SECTIONS,
  NAKAFA_MCP_DIRECT_ENDPOINT,
  NAKAFA_MCP_INFORMATIONAL_ROOT,
  NAKAFA_MCP_RECOMMENDED_ENDPOINT,
} from "@repo/contents/_lib/agent/constants";
import { NakafaAgentTaxonomySchema } from "@repo/contents/_lib/agent/schemas";
import { getNakafaAgentContentIndex } from "@repo/contents/_lib/agent/search";
import { getAllSurah } from "@repo/contents/_lib/quran";
import { ArticleCategorySchema } from "@repo/contents/_types/articles/category";
import type { Locale } from "@repo/contents/_types/content";
import { ExercisesCategorySchema } from "@repo/contents/_types/exercises/category";
import { ExercisesMaterialSchema } from "@repo/contents/_types/exercises/material";
import { ExercisesTypeSchema } from "@repo/contents/_types/exercises/type";
import { SubjectCategorySchema } from "@repo/contents/_types/subject/category";
import {
  NonNumericGradeSchema,
  NumericGradeSchema,
} from "@repo/contents/_types/subject/grade";
import {
  MaterialBachelorSchema,
  MaterialHighSchoolSchema,
} from "@repo/contents/_types/subject/material";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";

/** Retrieves the public Nakafa taxonomy and MCP endpoint guidance. */
export const getNakafaAgentTaxonomy = Effect.fn("NakafaAgent.getTaxonomy")(
  function* (locale: Locale = routing.defaultLocale) {
    const contentCounts = yield* Effect.forEach(
      routing.locales,
      (currentLocale) =>
        getNakafaAgentContentIndex(currentLocale).pipe(
          Effect.map((items) => ({
            count: items.length,
            locale: currentLocale,
          }))
        ),
      { concurrency: "unbounded" }
    );

    return NakafaAgentTaxonomySchema.parse({
      articles: {
        categories: ArticleCategorySchema.options,
      },
      content_counts: contentCounts,
      default_locale: routing.defaultLocale,
      endpoints: {
        direct: NAKAFA_MCP_DIRECT_ENDPOINT,
        recommended: NAKAFA_MCP_RECOMMENDED_ENDPOINT,
        root_note: `${NAKAFA_MCP_INFORMATIONAL_ROOT} is informational only.`,
      },
      exercises: {
        categories: ExercisesCategorySchema.options,
        materials: ExercisesMaterialSchema.options,
        types: ExercisesTypeSchema.options,
      },
      locale,
      locales: routing.locales,
      quran: {
        surah_count: getAllSurah().length,
      },
      sections: NAKAFA_AGENT_SECTIONS,
      subject: {
        categories: SubjectCategorySchema.options,
        grades: [
          ...NumericGradeSchema.options,
          ...NonNumericGradeSchema.options,
        ],
        materials: [
          ...MaterialHighSchoolSchema.options,
          ...MaterialBachelorSchema.options,
        ],
      },
      tools: [
        "nakafa_search_content",
        "nakafa_get_content",
        "nakafa_get_taxonomy",
        "nakafa_get_exercise",
        "nakafa_get_quran_reference",
      ],
    });
  }
);
