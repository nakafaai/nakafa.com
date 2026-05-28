import {
  DatabaseReader,
  StorageReader,
} from "@repo/backend/confect/_generated/services";
import type {
  AudioContentRef,
  AudioContentType,
} from "@repo/backend/confect/modules/content/audio.schemas";
import type { Locale } from "@repo/backend/confect/modules/content/content.schemas";
import { Effect, Option } from "effect";

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
  const reader = yield* DatabaseReader;

  if (contentRef.type === "article") {
    const article = yield* reader
      .table("articleContents")
      .get(contentRef.id)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

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

  const section = yield* reader
    .table("subjectSections")
    .get(contentRef.id)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

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
export const getAudioContentLookup = Effect.fn(
  "audioContent.getAudioContentLookup"
)(function* (contentRef: AudioContentRef) {
  const reader = yield* DatabaseReader;

  if (contentRef.type === "article") {
    const article = yield* reader
      .table("articleContents")
      .get(contentRef.id)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

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

  const section = yield* reader
    .table("subjectSections")
    .get(contentRef.id)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!section) {
    return null;
  }

  return {
    contentHash: section.contentHash,
    locale: section.locale,
    ref: { id: section._id, type: "subject" as const },
    slug: section.slug,
  };
});

/** Finds the localized sibling for an audio-capable content slug. */
export const getLocalizedAudioContentLookup = Effect.fn(
  "audioContent.getLocalizedAudioContentLookup"
)(function* (sourceContent: AudioContentLookup, locale: Locale) {
  const reader = yield* DatabaseReader;

  if (sourceContent.locale === locale) {
    return sourceContent;
  }

  if (sourceContent.ref.type === "article") {
    const article = yield* reader
      .table("articleContents")
      .index("by_locale_and_slug", (query) =>
        query.eq("locale", locale).eq("slug", sourceContent.slug)
      )
      .first()
      .pipe(Effect.map(Option.getOrNull));

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

  const section = yield* reader
    .table("subjectSections")
    .index("by_locale_and_slug", (query) =>
      query.eq("locale", locale).eq("slug", sourceContent.slug)
    )
    .first()
    .pipe(Effect.map(Option.getOrNull));

  if (!section) {
    return null;
  }

  return {
    contentHash: section.contentHash,
    locale: section.locale,
    ref: { id: section._id, type: "subject" as const },
    slug: section.slug,
  };
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
    contentType: AudioContentType;
    locale: Locale;
    slug: string;
  }) {
    const reader = yield* DatabaseReader;
    const storage = yield* StorageReader;
    const content =
      args.contentType === "article"
        ? yield* reader
            .table("articleContents")
            .index("by_locale_and_slug", (query) =>
              query.eq("locale", args.locale).eq("slug", args.slug)
            )
            .first()
            .pipe(Effect.map(Option.getOrNull))
        : yield* reader
            .table("subjectSections")
            .index("by_locale_and_slug", (query) =>
              query.eq("locale", args.locale).eq("slug", args.slug)
            )
            .first()
            .pipe(Effect.map(Option.getOrNull));

    if (!content) {
      return null;
    }

    const audio = yield* reader
      .table("contentAudios")
      .index("by_contentRefType_and_contentRefId_and_locale", (query) =>
        query
          .eq("contentRef.type", args.contentType)
          .eq("contentRef.id", content._id)
          .eq("locale", args.locale)
      )
      .first()
      .pipe(Effect.map(Option.getOrNull));

    if (!audio || audio.status !== "completed" || !audio.audioStorageId) {
      return null;
    }

    const audioStorageId = audio.audioStorageId;
    const audioUrl = yield* storage
      .getUrl(audioStorageId)
      .pipe(Effect.catchTag("BlobNotFoundError", () => Effect.succeed(null)));

    if (!audioUrl) {
      return null;
    }

    return {
      audioUrl: audioUrl.toString(),
      contentType: args.contentType,
      duration: audio.audioDuration ? audio.audioDuration / 1000 : 0,
      script: audio.script,
      status: audio.status,
    };
  }
);
