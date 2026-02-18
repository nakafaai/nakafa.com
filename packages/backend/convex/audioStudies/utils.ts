import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import type { AudioContentRef } from "@repo/backend/convex/lib/validators/audio";

interface ContentData {
  body: string;
  description?: string;
  locale: string;
  title: string;
}

/**
 * Fetches content data for audio generation.
 * Returns null if content not found.
 */
export async function fetchContentForAudio(
  ctx: QueryCtx,
  contentRef: AudioContentRef
): Promise<ContentData | null> {
  switch (contentRef.type) {
    case "article": {
      const article = await ctx.db.get("articleContents", contentRef.id);
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
      const section = await ctx.db.get("subjectSections", contentRef.id);
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

    default: {
      return null;
    }
  }
}

/**
 * Returns fields to reset when content changes.
 * Forces audio regeneration with new content hash.
 */
export function getResetAudioFields(contentHash: string) {
  return {
    contentHash,
    status: "pending" as const,
    script: undefined,
    audioStorageId: undefined,
    audioDuration: undefined,
    audioSize: undefined,
    errorMessage: undefined,
    failedAt: undefined,
    generationAttempts: 0,
    updatedAt: Date.now(),
  };
}
