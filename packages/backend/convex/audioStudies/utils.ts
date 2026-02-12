import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import type { ContentType } from "@repo/backend/convex/audioStudies/schema";

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
 * Fetch content data based on audio content type and ID.
 * Returns null if content not found.
 */
export async function fetchContentForAudio(
  ctx: QueryCtx,
  audio: {
    contentType: ContentType;
    contentId: Id<"articleContents"> | Id<"subjectSections">;
  }
): Promise<ContentData | null> {
  if (audio.contentType === "article") {
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
