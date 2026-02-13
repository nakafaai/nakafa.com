import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import type { ContentType } from "@repo/backend/convex/lib/validators/contents";

/**
 * Content data structure for script generation.
 */
export interface ContentData {
  title: string;
  description?: string;
  body: string;
  locale: string;
}

  /**
  * Content ID union type supporting all content types tracked for statistics.
  * Note: Exercise questions are not tracked individually - only exercise sets.
  */
  type ContentId =
    | Id<"articleContents">
    | Id<"subjectSections">
    | Id<"exerciseSets">;

/**
 * Fetch content data based on audio content type and ID.
 * Returns null if content not found.
 */
export async function fetchContentForAudio(
  ctx: QueryCtx,
  audio: {
    contentType: ContentType;
    contentId: ContentId;
  }
): Promise<ContentData | null> {
  switch (audio.contentType) {
    case "article": {
      const article = await ctx.db.get(
        "articleContents",
        audio.contentId as Id<"articleContents">
      );
      if (!article) {
        return null;
      }
      return {
        title: article.title,
        description: article.description,
        body: article.body,
        locale: article.locale,
      };
    }

    case "subject": {
      const section = await ctx.db.get(
        "subjectSections",
        audio.contentId as Id<"subjectSections">
      );
      if (!section) {
        return null;
      }
      return {
        title: section.title,
        description: section.description,
        body: section.body,
        locale: section.locale,
      };
    }

    case "exercise": {
      const exerciseSet = await ctx.db.get(
        "exerciseSets",
        audio.contentId as Id<"exerciseSets">
      );
      if (!exerciseSet) {
        return null;
      }
      return {
        title: exerciseSet.title,
        description: exerciseSet.description,
        body: `Exercise set: ${exerciseSet.exerciseType}`,
        locale: exerciseSet.locale,
      };
    }

    default: {
      return null;
    }
  }
}
