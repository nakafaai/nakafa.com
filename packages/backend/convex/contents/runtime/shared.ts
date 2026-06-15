import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import type { ContentAuthorContentId } from "@repo/backend/convex/authors/schema";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import { contentRuntimeIntegrityErrorCode } from "@repo/backend/convex/contents/runtime/spec";
import type { ContentType } from "@repo/backend/convex/lib/validators/contents";
import { ConvexError } from "convex/values";

/** Throws a structured integrity error for invalid synced content rows. */
export function throwRuntimeIntegrityError(message: string): never {
  throw new ConvexError({
    code: contentRuntimeIntegrityErrorCode,
    message,
  });
}

/** Formats a synced epoch timestamp back to the repository ISO date-only value. */
export function formatContentDate(epochMs: number) {
  const date = new Date(epochMs);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const year = date.getUTCFullYear();

  return `${year}-${month}-${day}`;
}

/** Loads ordered authors for one content row within the sync author limit. */
export async function getContentAuthors(
  ctx: QueryCtx,
  args: {
    contentId: ContentAuthorContentId;
    contentType: ContentType;
  }
) {
  const links = await ctx.db
    .query("contentAuthors")
    .withIndex("by_contentId_and_contentType_and_authorId", (q) =>
      q.eq("contentId", args.contentId).eq("contentType", args.contentType)
    )
    .take(CONTENT_SYNC_BATCH_LIMITS.authors + 1);

  if (links.length > CONTENT_SYNC_BATCH_LIMITS.authors) {
    throwRuntimeIntegrityError("Content author count exceeds the sync limit.");
  }

  const authors = await Promise.all(
    links.map(async (link) => {
      const author = await ctx.db.get(link.authorId);

      if (!author) {
        throwRuntimeIntegrityError(
          "Content author link points to a missing author."
        );
      }

      return {
        name: author.name,
        order: link.order,
      };
    })
  );

  return authors
    .sort((left, right) => left.order - right.order)
    .map((author) => ({ name: author.name }));
}
