import type {
  MutationCtx as ConvexMutationCtx,
  QueryCtx as ConvexQueryCtx,
} from "@repo/backend/confect/_generated/services";
import { QueryCtx } from "@repo/backend/confect/_generated/services";
import type { AudioContentRef } from "@repo/backend/confect/modules/content/audio.schemas";
import type { Locale } from "@repo/backend/confect/modules/content/content.schemas";
import { Effect } from "effect";

export interface AudioContentLookup {
  readonly contentHash: string;
  readonly locale: Locale;
  readonly ref: AudioContentRef;
  readonly slug: string;
}

/** Reads article or subject body fields used for audio script generation. */
export const fetchContentForAudio = Effect.fn(
  "audioContent.fetchContentForAudio"
)(function* (contentRef: AudioContentRef) {
  const ctx = yield* QueryCtx;

  if (contentRef.type === "article") {
    const article = yield* Effect.promise(() => ctx.db.get(contentRef.id));

    if (!article) {
      return null;
    }

    return {
      body: article.body,
      description: article.description,
      locale: article.locale,
      title: article.title,
    };
  }

  const section = yield* Effect.promise(() => ctx.db.get(contentRef.id));

  if (!section) {
    return null;
  }

  return {
    body: section.body,
    description: section.description,
    locale: section.locale,
    title: section.title,
  };
});

/** Reads slug, locale, hash, and reference data for audio-capable content. */
export async function readAudioContentLookup(
  ctx: ConvexQueryCtx | ConvexMutationCtx,
  contentRef: AudioContentRef
) {
  if (contentRef.type === "article") {
    const article = await ctx.db.get(contentRef.id);

    if (!article) {
      return null;
    }

    return {
      contentHash: article.contentHash,
      locale: article.locale,
      ref: { id: article._id, type: "article" as const },
      slug: article.slug,
    };
  }

  const section = await ctx.db.get(contentRef.id);

  if (!section) {
    return null;
  }

  return {
    contentHash: section.contentHash,
    locale: section.locale,
    ref: { id: section._id, type: "subject" as const },
    slug: section.slug,
  };
}

/** Reads slug, locale, hash, and reference data for audio-capable content. */
export const getAudioContentLookup = Effect.fn(
  "audioContent.getAudioContentLookup"
)(function* (contentRef: AudioContentRef) {
  const ctx = yield* QueryCtx;
  return yield* Effect.promise(() => readAudioContentLookup(ctx, contentRef));
});

/** Finds the localized sibling for an audio-capable content slug. */
export async function readLocalizedAudioContentLookup(
  ctx: ConvexQueryCtx | ConvexMutationCtx,
  sourceContent: AudioContentLookup,
  locale: Locale
) {
  if (sourceContent.locale === locale) {
    return sourceContent;
  }

  if (sourceContent.ref.type === "article") {
    const article = await ctx.db
      .query("articleContents")
      .withIndex("by_locale_and_slug", (query) =>
        query.eq("locale", locale).eq("slug", sourceContent.slug)
      )
      .first();

    if (!article) {
      return null;
    }

    return {
      contentHash: article.contentHash,
      locale: article.locale,
      ref: { id: article._id, type: "article" as const },
      slug: article.slug,
    };
  }

  const section = await ctx.db
    .query("subjectSections")
    .withIndex("by_locale_and_slug", (query) =>
      query.eq("locale", locale).eq("slug", sourceContent.slug)
    )
    .first();

  if (!section) {
    return null;
  }

  return {
    contentHash: section.contentHash,
    locale: section.locale,
    ref: { id: section._id, type: "subject" as const },
    slug: section.slug,
  };
}

/** Finds the localized sibling for an audio-capable content slug. */
export const getLocalizedAudioContentLookup = Effect.fn(
  "audioContent.getLocalizedAudioContentLookup"
)(function* (sourceContent: AudioContentLookup, locale: Locale) {
  const ctx = yield* QueryCtx;
  return yield* Effect.promise(() =>
    readLocalizedAudioContentLookup(ctx, sourceContent, locale)
  );
});

/** Reads the current content hash for an audio-capable content reference. */
export const getContentHash = Effect.fn("audioContent.getContentHash")(
  function* (args: { contentRef: AudioContentRef }) {
    const content = yield* getAudioContentLookup(args.contentRef);
    return content?.contentHash ?? null;
  }
);

/** Reads completed public audio for a localized article or subject slug. */
export const getAudioBySlug = Effect.fn("audioContent.getAudioBySlug")(
  function* (args: {
    contentType: "article" | "subject";
    locale: Locale;
    slug: string;
  }) {
    const ctx = yield* QueryCtx;
    const content =
      args.contentType === "article"
        ? yield* Effect.promise(() =>
            ctx.db
              .query("articleContents")
              .withIndex("by_locale_and_slug", (query) =>
                query.eq("locale", args.locale).eq("slug", args.slug)
              )
              .first()
          )
        : yield* Effect.promise(() =>
            ctx.db
              .query("subjectSections")
              .withIndex("by_locale_and_slug", (query) =>
                query.eq("locale", args.locale).eq("slug", args.slug)
              )
              .first()
          );

    if (!content) {
      return null;
    }

    const audio = yield* Effect.promise(() =>
      ctx.db
        .query("contentAudios")
        .withIndex("by_contentRefType_and_contentRefId_and_locale", (query) =>
          query
            .eq("contentRef.type", args.contentType)
            .eq("contentRef.id", content._id)
            .eq("locale", args.locale)
        )
        .first()
    );

    if (!audio || audio.status !== "completed" || !audio.audioStorageId) {
      return null;
    }

    const audioStorageId = audio.audioStorageId;
    const audioUrl = yield* Effect.promise(() =>
      ctx.storage.getUrl(audioStorageId)
    );

    if (!audioUrl) {
      return null;
    }

    return {
      audioUrl,
      contentType: args.contentType,
      duration: audio.audioDuration ? audio.audioDuration / 1000 : 0,
      script: audio.script,
      status: audio.status,
    };
  }
);
