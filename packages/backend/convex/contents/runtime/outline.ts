import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import type {
  Grade,
  Locale,
  Material,
  SubjectCategory,
} from "@repo/backend/convex/lib/validators/contents";
import { ConvexError } from "convex/values";

const MAX_SUBJECT_OUTLINE_TOPICS = 100;
const MAX_SUBJECT_OUTLINE_SECTIONS_PER_TOPIC = 100;

interface SubjectOutlineArgs {
  category: SubjectCategory;
  grade: Grade;
  locale: Locale;
  material: Material;
}

/** Reads one subject material outline in authored topic and section order. */
export async function getSubjectOutlineImpl(
  ctx: QueryCtx,
  args: SubjectOutlineArgs
) {
  const topics = await ctx.db
    .query("subjectTopics")
    .withIndex("by_locale_and_category_and_grade_and_material_and_order", (q) =>
      q
        .eq("locale", args.locale)
        .eq("category", args.category)
        .eq("grade", args.grade)
        .eq("material", args.material)
    )
    .order("asc")
    .take(MAX_SUBJECT_OUTLINE_TOPICS + 1);

  if (topics.length > MAX_SUBJECT_OUTLINE_TOPICS) {
    throw new ConvexError({
      code: "SUBJECT_OUTLINE_TOPIC_LIMIT_EXCEEDED",
      message: "Subject material outline exceeds the supported topic limit.",
    });
  }

  return await Promise.all(
    topics.map(async (topic) => {
      if (topic.sectionCount > MAX_SUBJECT_OUTLINE_SECTIONS_PER_TOPIC) {
        throw new ConvexError({
          code: "SUBJECT_OUTLINE_SECTION_LIMIT_EXCEEDED",
          message:
            "Subject material outline exceeds the supported sections-per-topic limit.",
        });
      }

      const sections = await ctx.db
        .query("subjectSections")
        .withIndex("by_topicId_and_order", (q) => q.eq("topicId", topic._id))
        .order("asc")
        .take(MAX_SUBJECT_OUTLINE_SECTIONS_PER_TOPIC + 1);

      if (sections.length > MAX_SUBJECT_OUTLINE_SECTIONS_PER_TOPIC) {
        throw new ConvexError({
          code: "SUBJECT_OUTLINE_SECTION_LIMIT_EXCEEDED",
          message:
            "Subject material outline exceeds the supported sections-per-topic limit.",
        });
      }

      if (sections.length !== topic.sectionCount) {
        throw new ConvexError({
          code: "SUBJECT_OUTLINE_SECTION_COUNT_MISMATCH",
          message: "Subject material outline section count does not match.",
        });
      }

      return {
        description: topic.description,
        route: topic.slug,
        sections: sections.map((section) => ({
          route: section.slug,
          title: section.title,
        })),
        title: topic.title,
      };
    })
  );
}
