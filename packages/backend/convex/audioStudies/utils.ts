import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import type { AudioContentRef } from "@repo/backend/convex/lib/validators/audio";

/**
 * Content data structure for script generation.
 * Used internally within audioStudies module.
 */
interface ContentData {
  title: string;
  description?: string;
  body: string;
  locale: string;
}

/**
 * Fetch content data based on discriminated content reference.
 * Returns null if content not found.
 *
 * Type Safety:
 * - Uses discriminated union (AudioContentRef) for type-safe lookups
 * - TypeScript automatically narrows the id type based on the type discriminator
 * - No type assertions needed - clean TypeScript like JavaScript
 * - Type narrowing works automatically in switch statement
 *
 * @param ctx - Convex query context
 * @param contentRef - Discriminated content reference { type: "article" | "subject", id: Id }
 * @returns Content data or null if not found
 *
 * @example
 * ```typescript
 * const content = await fetchContentForAudio(ctx, { type: "article", id: articleId });
 * if (content) {
 *   console.log(content.title); // TypeScript knows this is safe
 * }
 * ```
 */
export async function fetchContentForAudio(
  ctx: QueryCtx,
  contentRef: AudioContentRef
): Promise<ContentData | null> {
  // TypeScript automatically narrows the type based on the discriminator
  // No assertions needed - this is the power of discriminated unions
  switch (contentRef.type) {
    case "article": {
      // TypeScript knows contentRef.id is Id<"articleContents">
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
      // TypeScript knows contentRef.id is Id<"subjectSections">
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
      // Exhaustive check - TypeScript ensures we handle all cases
      return null;
    }
  }
}

/**
 * Get reset fields for content audio when content changes.
 * Used by updateContentHash and createOrGetAudioRecord to reset all
 * generated data and force regeneration with new content hash.
 *
 * This ensures consistency across all places that reset audio generation state.
 *
 * @param contentHash - The new content hash
 * @returns Object with all fields to reset for regeneration
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
