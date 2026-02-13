import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import type { AudioContentRef } from "@repo/backend/convex/lib/validators/audio";

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
