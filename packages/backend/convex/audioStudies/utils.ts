import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import type { AudioContentRef } from "@repo/backend/convex/lib/validators/audio";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";

interface ContentData {
  body: string;
  description?: string;
  locale: Locale;
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

/**
 * Update every locale-specific audio row for one content ref when the content
 * hash changes, clearing any stale generated file.
 */
export async function updateContentHash(
  ctx: MutationCtx,
  contentRef: AudioContentRef,
  newHash: string
) {
  const audios = await ctx.db
    .query("contentAudios")
    .withIndex("contentRef_locale", (q) =>
      q
        .eq("contentRef.type", contentRef.type)
        .eq("contentRef.id", contentRef.id)
    )
    .take(10);

  let updatedCount = 0;

  for (const audio of audios) {
    if (audio.contentHash === newHash) {
      continue;
    }

    if (audio.audioStorageId) {
      await ctx.storage.delete(audio.audioStorageId);
    }

    await ctx.db.patch(
      "contentAudios",
      audio._id,
      getResetAudioFields(newHash)
    );
    updatedCount += 1;
  }

  return updatedCount;
}

/**
 * Returns the slug for a content item by type and ID.
 */
export async function getContentSlug(
  ctx: QueryCtx,
  contentRef: AudioContentRef
): Promise<string | null> {
  switch (contentRef.type) {
    case "article": {
      const article = await ctx.db.get("articleContents", contentRef.id);
      return article?.slug ?? null;
    }
    case "subject": {
      const section = await ctx.db.get("subjectSections", contentRef.id);
      return section?.slug ?? null;
    }
    default: {
      return null;
    }
  }
}

/**
 * Returns the content hash for a content item by type and ID.
 */
export async function getContentHash(
  ctx: QueryCtx,
  contentRef: AudioContentRef
): Promise<string | null> {
  switch (contentRef.type) {
    case "article": {
      const article = await ctx.db.get("articleContents", contentRef.id);
      return article?.contentHash ?? null;
    }
    case "subject": {
      const section = await ctx.db.get("subjectSections", contentRef.id);
      return section?.contentHash ?? null;
    }
    default: {
      return null;
    }
  }
}

/**
 * Returns the locale-specific content ref by slug and locale.
 */
export async function getContentRefBySlugAndLocale(
  ctx: QueryCtx,
  contentRef: AudioContentRef,
  locale: Locale
): Promise<AudioContentRef | null> {
  const slug = await getContentSlug(ctx, contentRef);

  if (!slug) {
    return null;
  }

  switch (contentRef.type) {
    case "article": {
      const article = await ctx.db
        .query("articleContents")
        .withIndex("locale_slug", (q) =>
          q.eq("locale", locale).eq("slug", slug)
        )
        .first();
      if (!article) {
        return null;
      }
      return { type: "article" as const, id: article._id };
    }
    case "subject": {
      const section = await ctx.db
        .query("subjectSections")
        .withIndex("locale_slug", (q) =>
          q.eq("locale", locale).eq("slug", slug)
        )
        .first();
      if (!section) {
        return null;
      }
      return { type: "subject" as const, id: section._id };
    }
    default: {
      return null;
    }
  }
}
