import { DEFAULT_VOICE_KEY, getVoiceConfig } from "@repo/ai/config/voices";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  ContentAudioDuplicateLimitExceededError,
  type ContentAudioIdArgs,
  ContentAudioIoError,
  ContentAudioNotFoundError,
  type ContentAudioRecord,
  type CreateOrGetContentAudioArgs,
  contentAudioDuplicateLimitExceededCode,
  contentAudioIoFailedCode,
  contentAudioNotFoundCode,
  type MarkContentAudioFailedArgs,
  type SaveAudioScriptArgs,
  type SaveGeneratedAudioArgs,
  type UpdateContentAudioHashArgs,
} from "@repo/backend/convex/audioStudies/contentAudios/spec";
import { getUnknownErrorMessage } from "@repo/backend/convex/lib/effect";
import {
  type AudioStatus,
  audioModelElevenV3,
  audioStatusCompleted,
  audioStatusGeneratingScript,
  audioStatusGeneratingSpeech,
  audioStatusPending,
  audioStatusScriptGenerated,
} from "@repo/backend/convex/lib/validators/audio";
import { Clock, Effect } from "effect";

const contentAudioDuplicateLimit = 3;

interface ResetGeneratedAudioFields {
  readonly audioDuration: undefined;
  readonly audioSize: undefined;
  readonly audioStorageId: undefined;
  readonly contentHash: ContentAudioRecord["contentHash"];
  readonly errorMessage: undefined;
  readonly failedAt: undefined;
  readonly generationAttempts: ContentAudioRecord["generationAttempts"];
  readonly script: undefined;
  readonly status: typeof audioStatusPending;
  readonly updatedAt: ContentAudioRecord["updatedAt"];
}

/** Maps thrown Convex IO failures into the content-audio error channel. */
function toContentAudioIoError(error: unknown) {
  return new ContentAudioIoError({
    code: contentAudioIoFailedCode,
    message: getUnknownErrorMessage(error),
  });
}

/** Returns fields that make a stale content-audio row retryable again. */
function resetGeneratedAudioFields(
  contentHash: string,
  updatedAt: number
): ResetGeneratedAudioFields {
  return {
    contentHash,
    status: audioStatusPending,
    script: undefined,
    audioStorageId: undefined,
    audioDuration: undefined,
    audioSize: undefined,
    errorMessage: undefined,
    failedAt: undefined,
    generationAttempts: 0,
    updatedAt,
  };
}

/** Loads one content-audio row or fails with a domain error. */
const requireContentAudio = Effect.fn(
  "audioStudies.contentAudios.requireContentAudio"
)(function* (ctx: MutationCtx, contentAudioId: ContentAudioRecord["_id"]) {
  const audio = yield* Effect.tryPromise({
    try: () => ctx.db.get("contentAudios", contentAudioId),
    catch: toContentAudioIoError,
  });

  if (audio) {
    return audio;
  }

  return yield* Effect.fail(
    new ContentAudioNotFoundError({
      code: contentAudioNotFoundCode,
      message: "Content audio record not found.",
    })
  );
});

/** Loads canonical rows for one content reference and locale. */
const loadContentAudioRecords = Effect.fn(
  "audioStudies.contentAudios.loadContentAudioRecords"
)(function* (ctx: MutationCtx, args: CreateOrGetContentAudioArgs) {
  const records = yield* Effect.tryPromise({
    try: () =>
      ctx.db
        .query("contentAudios")
        .withIndex("by_content_id_and_locale", (q) =>
          q.eq("content_id", args.content_id).eq("locale", args.locale)
        )
        .take(contentAudioDuplicateLimit),
    catch: toContentAudioIoError,
  });

  if (records.length < contentAudioDuplicateLimit) {
    return records;
  }

  return yield* Effect.fail(
    new ContentAudioDuplicateLimitExceededError({
      code: contentAudioDuplicateLimitExceededCode,
      message: "Content audio duplicate limit exceeded.",
    })
  );
});

/** Keeps the earliest content-audio row and deletes duplicate rows. */
const collapseDuplicateContentAudioRecords = Effect.fn(
  "audioStudies.contentAudios.collapseDuplicateContentAudioRecords"
)(function* (ctx: MutationCtx, records: readonly Doc<"contentAudios">[]) {
  const [keeper, ...duplicates] = records;

  if (!keeper) {
    return yield* Effect.fail(
      new ContentAudioNotFoundError({
        code: contentAudioNotFoundCode,
        message: "Content audio record not found.",
      })
    );
  }

  for (const duplicate of duplicates) {
    yield* Effect.tryPromise({
      try: () => ctx.db.delete(duplicate._id),
      catch: toContentAudioIoError,
    });
  }

  return keeper;
});

/** Atomically claims a retry-safe content-audio generation step. */
function claimContentAudioGeneration(
  ctx: MutationCtx,
  args: ContentAudioIdArgs,
  input: {
    readonly allowedStatuses: ReadonlySet<AudioStatus>;
    readonly nextStatus: AudioStatus;
  }
) {
  return Effect.gen(function* () {
    const audio = yield* requireContentAudio(ctx, args.contentAudioId);

    if (!input.allowedStatuses.has(audio.status)) {
      return false;
    }

    const now = yield* Clock.currentTimeMillis;
    yield* Effect.tryPromise({
      try: () =>
        ctx.db.patch("contentAudios", args.contentAudioId, {
          status: input.nextStatus,
          updatedAt: now,
        }),
      catch: toContentAudioIoError,
    });

    return true;
  });
}

/** Saves a generated script idempotently. */
export const saveAudioScript = Effect.fn(
  "audioStudies.contentAudios.saveAudioScript"
)(function* (ctx: MutationCtx, args: SaveAudioScriptArgs) {
  const audio = yield* requireContentAudio(ctx, args.contentAudioId);

  if (
    audio.script === args.script &&
    audio.status === audioStatusScriptGenerated
  ) {
    return null;
  }

  const now = yield* Clock.currentTimeMillis;
  yield* Effect.tryPromise({
    try: () =>
      ctx.db.patch("contentAudios", args.contentAudioId, {
        script: args.script,
        status: audioStatusScriptGenerated,
        updatedAt: now,
      }),
    catch: toContentAudioIoError,
  });

  return null;
});

/** Claims script generation for fresh or already-claimed rows. */
export const claimAudioScriptGeneration = Effect.fn(
  "audioStudies.contentAudios.claimAudioScriptGeneration"
)((ctx: MutationCtx, args: ContentAudioIdArgs) =>
  claimContentAudioGeneration(ctx, args, {
    allowedStatuses: new Set([audioStatusPending, audioStatusGeneratingScript]),
    nextStatus: audioStatusGeneratingScript,
  })
);

/** Claims speech generation after a script exists. */
export const claimAudioSpeechGeneration = Effect.fn(
  "audioStudies.contentAudios.claimAudioSpeechGeneration"
)((ctx: MutationCtx, args: ContentAudioIdArgs) =>
  claimContentAudioGeneration(ctx, args, {
    allowedStatuses: new Set([
      audioStatusScriptGenerated,
      audioStatusGeneratingSpeech,
    ]),
    nextStatus: audioStatusGeneratingSpeech,
  })
);

/** Saves generated audio metadata and deletes replaced storage. */
export const saveGeneratedAudio = Effect.fn(
  "audioStudies.contentAudios.saveGeneratedAudio"
)(function* (ctx: MutationCtx, args: SaveGeneratedAudioArgs) {
  const audio = yield* requireContentAudio(ctx, args.contentAudioId);

  if (
    audio.status === audioStatusCompleted &&
    audio.audioStorageId === args.storageId
  ) {
    return null;
  }

  const previousStorageId = audio.audioStorageId;
  if (previousStorageId && previousStorageId !== args.storageId) {
    yield* Effect.tryPromise({
      try: () => ctx.storage.delete(previousStorageId),
      catch: toContentAudioIoError,
    });
  }

  const now = yield* Clock.currentTimeMillis;
  yield* Effect.tryPromise({
    try: () =>
      ctx.db.patch("contentAudios", args.contentAudioId, {
        audioStorageId: args.storageId,
        audioDuration: args.duration,
        audioSize: args.size,
        status: audioStatusCompleted,
        updatedAt: now,
      }),
    catch: toContentAudioIoError,
  });

  return null;
});

/** Marks a failed generation step and returns the row to a retryable status. */
export const markContentAudioGenerationFailed = Effect.fn(
  "audioStudies.contentAudios.markContentAudioGenerationFailed"
)(function* (ctx: MutationCtx, args: MarkContentAudioFailedArgs) {
  const audio = yield* requireContentAudio(ctx, args.contentAudioId);

  if (audio.status === audioStatusPending) {
    return null;
  }

  const now = yield* Clock.currentTimeMillis;

  if (audio.status === audioStatusGeneratingScript) {
    yield* Effect.tryPromise({
      try: () =>
        ctx.db.patch("contentAudios", args.contentAudioId, {
          status: audioStatusPending,
          errorMessage: args.error,
          failedAt: now,
          generationAttempts: audio.generationAttempts + 1,
          updatedAt: now,
        }),
      catch: toContentAudioIoError,
    });
    return null;
  }

  if (audio.status !== audioStatusGeneratingSpeech) {
    return null;
  }

  yield* Effect.tryPromise({
    try: () =>
      ctx.db.patch("contentAudios", args.contentAudioId, {
        status: audioStatusScriptGenerated,
        errorMessage: args.error,
        failedAt: now,
        generationAttempts: audio.generationAttempts + 1,
        updatedAt: now,
      }),
    catch: toContentAudioIoError,
  });

  return null;
});

/** Updates stale audio hashes and clears outdated generated audio fields. */
export const updateContentAudioHash = Effect.fn(
  "audioStudies.contentAudios.updateContentAudioHash"
)(function* (ctx: MutationCtx, args: UpdateContentAudioHashArgs) {
  const audios = yield* Effect.tryPromise({
    try: () =>
      ctx.db
        .query("contentAudios")
        .withIndex("by_content_id", (q) => q.eq("content_id", args.content_id))
        .take(10),
    catch: toContentAudioIoError,
  });
  const now = yield* Clock.currentTimeMillis;
  let updatedCount = 0;

  for (const audio of audios) {
    if (audio.contentHash === args.newHash) {
      continue;
    }

    const audioStorageId = audio.audioStorageId;
    if (audioStorageId) {
      yield* Effect.tryPromise({
        try: () => ctx.storage.delete(audioStorageId),
        catch: toContentAudioIoError,
      });
    }

    yield* Effect.tryPromise({
      try: () =>
        ctx.db.patch(
          "contentAudios",
          audio._id,
          resetGeneratedAudioFields(args.newHash, now)
        ),
      catch: toContentAudioIoError,
    });
    updatedCount += 1;
  }

  return { updatedCount };
});

/** Creates or reuses the locale-specific audio row behind one queue item. */
export const createOrGetContentAudio = Effect.fn(
  "audioStudies.contentAudios.createOrGetContentAudio"
)(function* (ctx: MutationCtx, args: CreateOrGetContentAudioArgs) {
  const existingRecords = yield* loadContentAudioRecords(ctx, args);
  const existing =
    existingRecords.length <= 1
      ? existingRecords[0]
      : yield* collapseDuplicateContentAudioRecords(ctx, existingRecords);
  const now = yield* Clock.currentTimeMillis;

  if (existing) {
    if (existing.contentHash !== args.contentHash) {
      yield* Effect.tryPromise({
        try: () =>
          ctx.db.patch(
            "contentAudios",
            existing._id,
            resetGeneratedAudioFields(args.contentHash, now)
          ),
        catch: toContentAudioIoError,
      });
    }

    return existing._id;
  }

  const voiceConfig = getVoiceConfig(DEFAULT_VOICE_KEY);
  yield* Effect.tryPromise({
    try: () =>
      ctx.db.insert("contentAudios", {
        alignmentId: args.alignmentId,
        assetId: args.assetId,
        conceptId: args.conceptId,
        content_id: args.content_id,
        contentType: args.contentType,
        learningObjectId: args.learningObjectId,
        lensId: args.lensId,
        locale: args.locale,
        route: args.route,
        contentHash: args.contentHash,
        voiceId: voiceConfig.id,
        voiceSettings: voiceConfig.settings,
        model: audioModelElevenV3,
        status: audioStatusPending,
        generationAttempts: 0,
        updatedAt: now,
      }),
    catch: toContentAudioIoError,
  });

  const keeper = yield* collapseDuplicateContentAudioRecords(
    ctx,
    yield* loadContentAudioRecords(ctx, args)
  );

  if (keeper.contentHash !== args.contentHash) {
    yield* Effect.tryPromise({
      try: () =>
        ctx.db.patch(
          "contentAudios",
          keeper._id,
          resetGeneratedAudioFields(args.contentHash, now)
        ),
      catch: toContentAudioIoError,
    });
  }

  return keeper._id;
});
