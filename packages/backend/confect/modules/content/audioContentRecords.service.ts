import { ACTIVE_MODEL } from "@repo/ai/config/elevenlabs";
import { DEFAULT_VOICE_KEY, getVoiceConfig } from "@repo/ai/config/voices";
import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/confect/_generated/services";
import type {
  AudioContentRef,
  AudioStatus,
} from "@repo/backend/confect/modules/content/audio.schemas";
import { fetchContentForAudio } from "@repo/backend/confect/modules/content/audioContentLookup.service";
import type { Locale } from "@repo/backend/confect/modules/content/content.schemas";
import { Clock, Effect, Schema } from "effect";

const CONTENT_AUDIO_DUPLICATE_LIMIT = 3;

export class ContentAudioError extends Schema.TaggedError<ContentAudioError>()(
  "ContentAudioError",
  { message: Schema.String }
) {}

/** Builds reset fields when source content changes. */
function getResetAudioFields(contentHash: string, updatedAt: number) {
  return {
    audioDuration: undefined,
    audioSize: undefined,
    audioStorageId: undefined,
    contentHash,
    errorMessage: undefined,
    failedAt: undefined,
    generationAttempts: 0,
    script: undefined,
    status: "pending" as const,
    updatedAt,
  };
}

/** Requires an audio record to exist. */
const requireContentAudio = Effect.fn("audioContent.requireContentAudio")(
  function* (contentAudioId: Id<"contentAudios">) {
    const ctx = yield* MutationCtx;
    const audio = yield* Effect.promise(() => ctx.db.get(contentAudioId));

    if (audio) {
      return audio;
    }

    return yield* Effect.fail(
      new ContentAudioError({ message: "Audio record not found." })
    );
  }
);

/** Loads possible duplicate audio records for one content locale. */
const loadContentAudioRecords = Effect.fn(
  "audioContent.loadContentAudioRecords"
)(function* (args: { contentRef: AudioContentRef; locale: Locale }) {
  const ctx = yield* MutationCtx;
  const records = yield* Effect.promise(() =>
    ctx.db
      .query("contentAudios")
      .withIndex("by_contentRefType_and_contentRefId_and_locale", (query) =>
        query
          .eq("contentRef.type", args.contentRef.type)
          .eq("contentRef.id", args.contentRef.id)
          .eq("locale", args.locale)
      )
      .take(CONTENT_AUDIO_DUPLICATE_LIMIT)
  );

  if (records.length < CONTENT_AUDIO_DUPLICATE_LIMIT) {
    return records;
  }

  return yield* Effect.fail(
    new ContentAudioError({
      message: "Content audio duplicate limit exceeded.",
    })
  );
});

/** Keeps the first audio record and removes duplicate rows. */
const collapseDuplicateContentAudioRecords = Effect.fn(
  "audioContent.collapseDuplicateContentAudioRecords"
)(function* (records: readonly Doc<"contentAudios">[]) {
  const ctx = yield* MutationCtx;
  const [keeper, ...duplicates] = records;

  if (!keeper) {
    return yield* Effect.fail(
      new ContentAudioError({ message: "Content audio record not found." })
    );
  }

  for (const duplicate of duplicates) {
    yield* Effect.promise(() => ctx.db.delete(duplicate._id));
  }

  return keeper;
});

/** Moves an audio record to the next generation status when claimable. */
const claimContentAudioGeneration = Effect.fn(
  "audioContent.claimContentAudioGeneration"
)(function* (args: {
  allowedStatuses: readonly AudioStatus[];
  contentAudioId: Id<"contentAudios">;
  nextStatus: AudioStatus;
}) {
  const ctx = yield* MutationCtx;
  const audio = yield* requireContentAudio(args.contentAudioId);

  if (!args.allowedStatuses.includes(audio.status)) {
    return false;
  }

  const updatedAt = yield* Clock.currentTimeMillis;
  yield* Effect.promise(() =>
    ctx.db.patch(args.contentAudioId, {
      status: args.nextStatus,
      updatedAt,
    })
  );

  return true;
});

/** Claims an audio record for script generation. */
export const claimScriptGeneration = Effect.fn(
  "audioContent.claimScriptGeneration"
)(function* (args: { contentAudioId: Id<"contentAudios"> }) {
  return yield* claimContentAudioGeneration({
    allowedStatuses: ["pending", "generating-script"],
    contentAudioId: args.contentAudioId,
    nextStatus: "generating-script",
  });
});

/** Claims an audio record for speech generation. */
export const claimSpeechGeneration = Effect.fn(
  "audioContent.claimSpeechGeneration"
)(function* (args: { contentAudioId: Id<"contentAudios"> }) {
  return yield* claimContentAudioGeneration({
    allowedStatuses: ["script-generated", "generating-speech"],
    contentAudioId: args.contentAudioId,
    nextStatus: "generating-speech",
  });
});

/** Saves a generated script for an audio record. */
export const saveScript = Effect.fn("audioContent.saveScript")(
  function* (args: { contentAudioId: Id<"contentAudios">; script: string }) {
    const ctx = yield* MutationCtx;
    const audio = yield* requireContentAudio(args.contentAudioId);

    if (audio.script === args.script && audio.status === "script-generated") {
      return null;
    }

    const updatedAt = yield* Clock.currentTimeMillis;
    yield* Effect.promise(() =>
      ctx.db.patch(args.contentAudioId, {
        script: args.script,
        status: "script-generated",
        updatedAt,
      })
    );

    return null;
  }
);

/** Saves generated audio storage metadata. */
export const saveAudio = Effect.fn("audioContent.saveAudio")(function* (args: {
  contentAudioId: Id<"contentAudios">;
  duration: number;
  size: number;
  storageId: Id<"_storage">;
}) {
  const ctx = yield* MutationCtx;
  const audio = yield* requireContentAudio(args.contentAudioId);

  if (audio.status === "completed" && audio.audioStorageId === args.storageId) {
    return null;
  }

  if (audio.audioStorageId && audio.audioStorageId !== args.storageId) {
    const audioStorageId = audio.audioStorageId;
    yield* Effect.promise(() => ctx.storage.delete(audioStorageId));
  }

  const updatedAt = yield* Clock.currentTimeMillis;
  yield* Effect.promise(() =>
    ctx.db.patch(args.contentAudioId, {
      audioDuration: args.duration,
      audioSize: args.size,
      audioStorageId: args.storageId,
      status: "completed",
      updatedAt,
    })
  );

  return null;
});

/** Marks an in-flight audio generation attempt as failed or retryable. */
export const markFailed = Effect.fn("audioContent.markFailed")(
  function* (args: { contentAudioId: Id<"contentAudios">; error: string }) {
    const ctx = yield* MutationCtx;
    const audio = yield* requireContentAudio(args.contentAudioId);

    if (audio.status === "pending") {
      return null;
    }

    if (
      audio.status !== "generating-script" &&
      audio.status !== "generating-speech"
    ) {
      return null;
    }

    const now = yield* Clock.currentTimeMillis;
    const status =
      audio.status === "generating-script" ? "pending" : "script-generated";

    yield* Effect.promise(() =>
      ctx.db.patch(args.contentAudioId, {
        errorMessage: args.error,
        failedAt: now,
        generationAttempts: audio.generationAttempts + 1,
        status,
        updatedAt: now,
      })
    );

    return null;
  }
);

/** Updates stored content audio hashes and resets stale audio records. */
export const updateContentHash = Effect.fn("audioContent.updateContentHash")(
  function* (args: { contentRef: AudioContentRef; newHash: string }) {
    const ctx = yield* MutationCtx;
    const audios = yield* Effect.promise(() =>
      ctx.db
        .query("contentAudios")
        .withIndex("by_contentRefType_and_contentRefId_and_locale", (query) =>
          query
            .eq("contentRef.type", args.contentRef.type)
            .eq("contentRef.id", args.contentRef.id)
        )
        .take(10)
    );
    const updatedAt = yield* Clock.currentTimeMillis;
    let updatedCount = 0;

    for (const audio of audios) {
      if (audio.contentHash === args.newHash) {
        continue;
      }

      if (audio.audioStorageId) {
        const audioStorageId = audio.audioStorageId;
        yield* Effect.promise(() => ctx.storage.delete(audioStorageId));
      }

      yield* Effect.promise(() =>
        ctx.db.patch(audio._id, getResetAudioFields(args.newHash, updatedAt))
      );
      updatedCount += 1;
    }

    return { updatedCount };
  }
);

/** Creates or returns the audio record for a content locale. */
export const createOrGetAudioRecord = Effect.fn(
  "audioContent.createOrGetAudioRecord"
)(function* (args: {
  contentHash: string;
  contentRef: AudioContentRef;
  locale: Locale;
}) {
  const ctx = yield* MutationCtx;
  const existingRecords = yield* loadContentAudioRecords(args);
  const existing =
    existingRecords.length <= 1
      ? existingRecords[0]
      : yield* collapseDuplicateContentAudioRecords(existingRecords);
  const updatedAt = yield* Clock.currentTimeMillis;

  if (existing) {
    if (existing.contentHash !== args.contentHash) {
      yield* Effect.promise(() =>
        ctx.db.patch(
          existing._id,
          getResetAudioFields(args.contentHash, updatedAt)
        )
      );
    }

    return existing._id;
  }

  const voiceConfig = getVoiceConfig(DEFAULT_VOICE_KEY);
  yield* Effect.promise(() =>
    ctx.db.insert("contentAudios", {
      contentHash: args.contentHash,
      contentRef: args.contentRef,
      generationAttempts: 0,
      locale: args.locale,
      model: ACTIVE_MODEL,
      status: "pending",
      updatedAt,
      voiceId: voiceConfig.id,
      voiceSettings: voiceConfig.settings,
    })
  );

  const keeper = yield* collapseDuplicateContentAudioRecords(
    yield* loadContentAudioRecords(args)
  );

  if (keeper.contentHash !== args.contentHash) {
    yield* Effect.promise(() =>
      ctx.db.patch(keeper._id, getResetAudioFields(args.contentHash, updatedAt))
    );
  }

  return keeper._id;
});

/** Reads audio and source content for script generation. */
export const getAudioAndContentForScriptGeneration = Effect.fn(
  "audioContent.getAudioAndContentForScriptGeneration"
)(function* (args: { contentAudioId: Id<"contentAudios"> }) {
  const ctx = yield* QueryCtx;
  const audio = yield* Effect.promise(() => ctx.db.get(args.contentAudioId));

  if (!audio) {
    return null;
  }

  const content = yield* fetchContentForAudio(audio.contentRef);

  if (!content) {
    return null;
  }

  return {
    content,
    contentAudio: {
      contentHash: audio.contentHash,
      contentRef: audio.contentRef,
      status: audio.status,
      voiceId: audio.voiceId,
      voiceSettings: audio.voiceSettings,
    },
  };
});

/** Reads script and voice metadata for speech generation. */
export const getAudioForSpeechGeneration = Effect.fn(
  "audioContent.getAudioForSpeechGeneration"
)(function* (args: { contentAudioId: Id<"contentAudios"> }) {
  const ctx = yield* QueryCtx;
  const audio = yield* Effect.promise(() => ctx.db.get(args.contentAudioId));

  if (!audio?.script) {
    return null;
  }

  return {
    contentHash: audio.contentHash,
    model: audio.model,
    script: audio.script,
    voiceId: audio.voiceId,
    voiceSettings: audio.voiceSettings,
  };
});

/** Returns whether an audio record still matches an expected content hash. */
export const verifyContentHash = Effect.fn("audioContent.verifyContentHash")(
  function* (args: {
    contentAudioId: Id<"contentAudios">;
    expectedHash: string;
  }) {
    const ctx = yield* QueryCtx;
    const audio = yield* Effect.promise(() => ctx.db.get(args.contentAudioId));
    return audio?.contentHash === args.expectedHash;
  }
);
