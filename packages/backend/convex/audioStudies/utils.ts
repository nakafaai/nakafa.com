import type { Id } from "@repo/backend/convex/_generated/dataModel";
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
 * Marks a queue item as completed. Idempotent.
 * Use this helper to avoid ctx.runMutation from within mutations.
 */
export async function markQueueCompletedHelper(
  ctx: MutationCtx,
  queueItemId: Id<"audioGenerationQueue">
): Promise<null> {
  const item = await ctx.db.get("audioGenerationQueue", queueItemId);

  if (!item) {
    return null;
  }

  if (item.status === "completed") {
    return null;
  }

  const now = Date.now();
  await ctx.db.patch("audioGenerationQueue", queueItemId, {
    status: "completed",
    completedAt: now,
    updatedAt: now,
  });

  return null;
}

/**
 * Marks a queue item as failed. Prevents infinite retries by checking maxRetries.
 * Use this helper to avoid ctx.runMutation from within mutations.
 */
export async function markQueueFailedHelper(
  ctx: MutationCtx,
  queueItemId: Id<"audioGenerationQueue">,
  error: string
): Promise<null> {
  const item = await ctx.db.get("audioGenerationQueue", queueItemId);

  if (!item) {
    return null;
  }

  if (item.status === "completed" || item.status === "failed") {
    return null;
  }

  const now = Date.now();
  const newRetryCount = item.retryCount + 1;

  if (newRetryCount >= item.maxRetries) {
    await ctx.db.patch("audioGenerationQueue", queueItemId, {
      status: "failed",
      errorMessage: `Max retries exceeded (${item.maxRetries}): ${error}`,
      lastErrorAt: now,
      retryCount: newRetryCount,
      updatedAt: now,
    });
    return null;
  }

  await ctx.db.patch("audioGenerationQueue", queueItemId, {
    status: "pending",
    errorMessage: error,
    lastErrorAt: now,
    retryCount: newRetryCount,
    updatedAt: now,
  });

  return null;
}

/**
 * Updates content hash and clears outdated audio data when content changes.
 * Idempotent: Skips if hash already matches.
 * Use this helper to avoid ctx.runMutation from within mutations.
 */
export async function updateContentHashHelper(
  ctx: MutationCtx,
  contentRef: AudioContentRef,
  newHash: string
): Promise<{ updatedCount: number }> {
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

    updatedCount++;
  }

  return { updatedCount };
}

/**
 * Gets the content slug for a given content reference.
 * Returns null if content not found.
 */
export async function getContentSlugHelper(
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
 * Gets content hash for a content reference.
 * Returns null if content not found.
 */
export async function getContentHashHelper(
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
 * Gets content reference by slug and locale for cross-locale lookups.
 * Returns null if content not found.
 */
export async function getContentRefBySlugAndLocaleHelper(
  ctx: QueryCtx,
  contentRef: AudioContentRef,
  locale: Locale
): Promise<AudioContentRef | null> {
  let slug: string | null = null;
  switch (contentRef.type) {
    case "article": {
      const article = await ctx.db.get("articleContents", contentRef.id);
      slug = article?.slug ?? null;
      break;
    }
    case "subject": {
      const section = await ctx.db.get("subjectSections", contentRef.id);
      slug = section?.slug ?? null;
      break;
    }
    default: {
      return null;
    }
  }

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
