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

interface AudioContentLookup {
  contentHash: string;
  locale: Locale;
  ref: AudioContentRef;
  slug: string;
}

type AudioContentReaderCtx = Pick<QueryCtx, "db">;

/**
 * Fetches content data for audio generation.
 * Returns null if content not found.
 */
export async function fetchContentForAudio(
  ctx: QueryCtx,
  contentRef: AudioContentRef
): Promise<ContentData | null> {
  if (contentRef.type === "article") {
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
 * Loads the minimal audio-related metadata for one content reference.
 * This keeps hot queueing paths from rereading the same large content row.
 */
export async function getAudioContentLookup(
  ctx: AudioContentReaderCtx,
  contentRef: AudioContentRef
): Promise<AudioContentLookup | null> {
  if (contentRef.type === "article") {
    const article = await ctx.db.get("articleContents", contentRef.id);

    if (!article) {
      return null;
    }

    return {
      contentHash: article.contentHash,
      locale: article.locale,
      ref: { type: "article", id: article._id },
      slug: article.slug,
    };
  }

  const section = await ctx.db.get("subjectSections", contentRef.id);

  if (!section) {
    return null;
  }

  return {
    contentHash: section.contentHash,
    locale: section.locale,
    ref: { type: "subject", id: section._id },
    slug: section.slug,
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
    .withIndex("by_contentRefType_and_contentRefId_and_locale", (q) =>
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
 * Resolves one locale-specific content row while reusing the already loaded
 * source row whenever the requested locale already matches.
 */
export async function getLocalizedAudioContentLookup(
  ctx: AudioContentReaderCtx,
  sourceContent: AudioContentLookup,
  locale: Locale
): Promise<AudioContentLookup | null> {
  if (sourceContent.locale === locale) {
    return sourceContent;
  }

  if (sourceContent.ref.type === "article") {
    const article = await ctx.db
      .query("articleContents")
      .withIndex("by_locale_and_slug", (q) =>
        q.eq("locale", locale).eq("slug", sourceContent.slug)
      )
      .first();

    if (!article) {
      return null;
    }

    return {
      contentHash: article.contentHash,
      locale: article.locale,
      ref: { type: "article", id: article._id },
      slug: article.slug,
    };
  }

  const section = await ctx.db
    .query("subjectSections")
    .withIndex("by_locale_and_slug", (q) =>
      q.eq("locale", locale).eq("slug", sourceContent.slug)
    )
    .first();

  if (!section) {
    return null;
  }

  return {
    contentHash: section.contentHash,
    locale: section.locale,
    ref: { type: "subject", id: section._id },
    slug: section.slug,
  };
}
