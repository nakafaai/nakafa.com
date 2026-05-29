import { ACTIVE_MODEL } from "@repo/ai/config/elevenlabs";
import { DEFAULT_VOICE_KEY, getVoiceConfig } from "@repo/ai/config/voices";
import type { Id } from "@repo/backend/confect/_generated/dataModel";
import {
  DatabaseReader,
  DatabaseWriter,
  StorageWriter,
} from "@repo/backend/confect/_generated/services";
import type {
  AudioContentRef,
  AudioStatus,
} from "@repo/backend/confect/modules/content/audio.schemas";
import { fetchContentForAudio } from "@repo/backend/confect/modules/content/audioContentLookup.service";
import type { ContentAudios } from "@repo/backend/confect/modules/content/audioStudies.tables";
import type { Locale } from "@repo/backend/confect/modules/content/content.schemas";
import { Clock, Effect, Schema } from "effect";

const CONTENT_AUDIO_DUPLICATE_LIMIT = 3;
type ContentAudioDoc = Schema.Schema.Type<typeof ContentAudios.Doc>;

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
const requireContentAudio = Effect.fnUntraced(function* (
  contentAudioId: Id<"contentAudios">
) {
  const reader = yield* DatabaseReader;
  const audio = yield* reader
    .table("contentAudios")
    .get(contentAudioId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (audio) {
    return audio;
  }

  return yield* Effect.fail(
    new ContentAudioError({ message: "Audio record not found." })
  );
});

/** Loads possible duplicate audio records for one content locale. */
const loadContentAudioRecords = Effect.fnUntraced(function* (args: {
  contentRef: AudioContentRef;
  locale: Locale;
}) {
  const reader = yield* DatabaseReader;
  const records = yield* reader
    .table("contentAudios")
    .index("by_contentRefType_and_contentRefId_and_locale", (query) =>
      query
        .eq("contentRef.type", args.contentRef.type)
        .eq("contentRef.id", args.contentRef.id)
        .eq("locale", args.locale)
    )
    .take(CONTENT_AUDIO_DUPLICATE_LIMIT);

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
const collapseDuplicateContentAudioRecords = Effect.fnUntraced(function* (
  records: readonly ContentAudioDoc[]
) {
  const writer = yield* DatabaseWriter;
  const [keeper, ...duplicates] = records;

  if (!keeper) {
    return yield* Effect.fail(
      new ContentAudioError({ message: "Content audio record not found." })
    );
  }

  for (const duplicate of duplicates) {
    yield* writer.table("contentAudios").delete(duplicate._id);
  }

  return keeper;
});

/** Moves an audio record to the next generation status when claimable. */
const claimContentAudioGeneration = Effect.fnUntraced(function* (args: {
  allowedStatuses: readonly AudioStatus[];
  contentAudioId: Id<"contentAudios">;
  nextStatus: AudioStatus;
}) {
  const writer = yield* DatabaseWriter;
  const audio = yield* requireContentAudio(args.contentAudioId);

  if (!args.allowedStatuses.includes(audio.status)) {
    return false;
  }

  const updatedAt = yield* Clock.currentTimeMillis;
  yield* writer.table("contentAudios").patch(args.contentAudioId, {
    status: args.nextStatus,
    updatedAt,
  });

  return true;
});

/** Claims an audio record for script generation. */
export const claimScriptGeneration = Effect.fnUntraced(function* (args: {
  contentAudioId: Id<"contentAudios">;
}) {
  return yield* claimContentAudioGeneration({
    allowedStatuses: ["pending", "generating-script"],
    contentAudioId: args.contentAudioId,
    nextStatus: "generating-script",
  });
});

/** Claims an audio record for speech generation. */
export const claimSpeechGeneration = Effect.fnUntraced(function* (args: {
  contentAudioId: Id<"contentAudios">;
}) {
  return yield* claimContentAudioGeneration({
    allowedStatuses: ["script-generated", "generating-speech"],
    contentAudioId: args.contentAudioId,
    nextStatus: "generating-speech",
  });
});

/** Saves a generated script for an audio record. */
export const saveScript = Effect.fnUntraced(function* (args: {
  contentAudioId: Id<"contentAudios">;
  script: string;
}) {
  const writer = yield* DatabaseWriter;
  const audio = yield* requireContentAudio(args.contentAudioId);

  if (audio.script === args.script && audio.status === "script-generated") {
    return null;
  }

  const updatedAt = yield* Clock.currentTimeMillis;
  yield* writer.table("contentAudios").patch(args.contentAudioId, {
    script: args.script,
    status: "script-generated",
    updatedAt,
  });

  return null;
});

/** Saves generated audio storage metadata. */
export const saveAudio = Effect.fnUntraced(function* (args: {
  contentAudioId: Id<"contentAudios">;
  duration: number;
  size: number;
  storageId: Id<"_storage">;
}) {
  const writer = yield* DatabaseWriter;
  const storage = yield* StorageWriter;
  const audio = yield* requireContentAudio(args.contentAudioId);

  if (audio.status === "completed" && audio.audioStorageId === args.storageId) {
    return null;
  }

  if (audio.audioStorageId && audio.audioStorageId !== args.storageId) {
    const audioStorageId = audio.audioStorageId;
    yield* storage
      .delete(audioStorageId)
      .pipe(Effect.catchTag("BlobNotFoundError", () => Effect.succeed(null)));
  }

  const updatedAt = yield* Clock.currentTimeMillis;
  yield* writer.table("contentAudios").patch(args.contentAudioId, {
    audioDuration: args.duration,
    audioSize: args.size,
    audioStorageId: args.storageId,
    status: "completed",
    updatedAt,
  });

  return null;
});

/** Marks an in-flight audio generation attempt as failed or retryable. */
export const markFailed = Effect.fnUntraced(function* (args: {
  contentAudioId: Id<"contentAudios">;
  error: string;
}) {
  const writer = yield* DatabaseWriter;
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

  yield* writer.table("contentAudios").patch(args.contentAudioId, {
    errorMessage: args.error,
    failedAt: now,
    generationAttempts: audio.generationAttempts + 1,
    status,
    updatedAt: now,
  });

  return null;
});

/** Updates stored content audio hashes and resets stale audio records. */
export const updateContentHash = Effect.fnUntraced(function* (args: {
  contentRef: AudioContentRef;
  newHash: string;
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const storage = yield* StorageWriter;
  const audios = yield* reader
    .table("contentAudios")
    .index("by_contentRefType_and_contentRefId_and_locale", (query) =>
      query
        .eq("contentRef.type", args.contentRef.type)
        .eq("contentRef.id", args.contentRef.id)
    )
    .take(10);
  const updatedAt = yield* Clock.currentTimeMillis;
  let updatedCount = 0;

  for (const audio of audios) {
    if (audio.contentHash === args.newHash) {
      continue;
    }

    if (audio.audioStorageId) {
      const audioStorageId = audio.audioStorageId;
      yield* storage
        .delete(audioStorageId)
        .pipe(Effect.catchTag("BlobNotFoundError", () => Effect.succeed(null)));
    }

    yield* writer
      .table("contentAudios")
      .patch(audio._id, getResetAudioFields(args.newHash, updatedAt));
    updatedCount += 1;
  }

  return { updatedCount };
});

/** Creates or returns the audio record for a content locale. */
export const createOrGetAudioRecord = Effect.fnUntraced(function* (args: {
  contentHash: string;
  contentRef: AudioContentRef;
  locale: Locale;
}) {
  const writer = yield* DatabaseWriter;
  const existingRecords = yield* loadContentAudioRecords(args);
  const existing =
    existingRecords.length <= 1
      ? existingRecords[0]
      : yield* collapseDuplicateContentAudioRecords(existingRecords);
  const updatedAt = yield* Clock.currentTimeMillis;

  if (existing) {
    if (existing.contentHash !== args.contentHash) {
      yield* writer
        .table("contentAudios")
        .patch(existing._id, getResetAudioFields(args.contentHash, updatedAt));
    }

    return existing._id;
  }

  const voiceConfig = getVoiceConfig(DEFAULT_VOICE_KEY);
  yield* writer.table("contentAudios").insert({
    contentHash: args.contentHash,
    contentRef: args.contentRef,
    generationAttempts: 0,
    locale: args.locale,
    model: ACTIVE_MODEL,
    status: "pending",
    updatedAt,
    voiceId: voiceConfig.id,
    voiceSettings: voiceConfig.settings,
  });

  const keeper = yield* collapseDuplicateContentAudioRecords(
    yield* loadContentAudioRecords(args)
  );

  if (keeper.contentHash !== args.contentHash) {
    yield* writer
      .table("contentAudios")
      .patch(keeper._id, getResetAudioFields(args.contentHash, updatedAt));
  }

  return keeper._id;
});

/** Reads audio and source content for script generation. */
export const getAudioAndContentForScriptGeneration = Effect.fnUntraced(
  function* (args: { contentAudioId: Id<"contentAudios"> }) {
    const reader = yield* DatabaseReader;
    const audio = yield* reader
      .table("contentAudios")
      .get(args.contentAudioId)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

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
  }
);

/** Reads script and voice metadata for speech generation. */
export const getAudioForSpeechGeneration = Effect.fnUntraced(function* (args: {
  contentAudioId: Id<"contentAudios">;
}) {
  const reader = yield* DatabaseReader;
  const audio = yield* reader
    .table("contentAudios")
    .get(args.contentAudioId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

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
export const verifyContentHash = Effect.fnUntraced(function* (args: {
  contentAudioId: Id<"contentAudios">;
  expectedHash: string;
}) {
  const reader = yield* DatabaseReader;
  const audio = yield* reader
    .table("contentAudios")
    .get(args.contentAudioId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));
  return audio?.contentHash === args.expectedHash;
});
