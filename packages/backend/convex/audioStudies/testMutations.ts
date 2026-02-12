import type { WorkflowId } from "@convex-dev/workflow";
import { ACTIVE_MODEL } from "@repo/ai/config/elevenlabs";
import { DEFAULT_VOICE_KEY, getVoiceConfig } from "@repo/ai/config/voices";
import { internal } from "@repo/backend/convex/_generated/api";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import {
  contentIdValidator,
  contentTypeValidator,
} from "@repo/backend/convex/audioStudies/schema";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { workflow } from "@repo/backend/convex/workflow";
import { v } from "convex/values";

/**
 * Create a test audio record for manual testing.
 * Used by the test script to generate audio for specific content.
 */
export const createTestRecord = internalMutation({
  args: {
    contentId: contentIdValidator,
    contentType: contentTypeValidator,
    locale: v.string(),
  },
  returns: vv.id("contentAudios"),
  handler: async (ctx, args) => {
    // Generate a hash based on content ID and timestamp
    const testHash = `test-${Date.now()}`;

    // Use the default voice config from the centralized voices config
    const voiceConfig = getVoiceConfig(DEFAULT_VOICE_KEY);

    const audioId = await ctx.db.insert("contentAudios", {
      contentId: args.contentId,
      contentType: args.contentType,
      locale: args.locale as "en" | "id",
      contentHash: testHash,
      voiceId: voiceConfig.id,
      voiceSettings: voiceConfig.settings,
      model: ACTIVE_MODEL,
      status: "pending",
      generationAttempts: 0,
      updatedAt: Date.now(),
    });

    return audioId;
  },
});

/**
 * Delete a test audio record and its associated audio file.
 * Use this to clean up after testing.
 */
export const deleteTestRecord = internalMutation({
  args: {
    contentAudioId: vv.id("contentAudios"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const audio = await ctx.db.get(args.contentAudioId);

    if (!audio) {
      return null;
    }

    // Delete audio file from storage if exists
    if (audio.audioStorageId) {
      await ctx.storage.delete(audio.audioStorageId);
    }

    // Delete the record
    await ctx.db.delete(args.contentAudioId);

    return null;
  },
});

/**
 * Schedule script generation to run in the background.
 * Use this instead of calling generateScript directly to avoid CLI timeout.
 * The CLI returns immediately, and the action runs asynchronously.
 */
export const scheduleGenerateScript = internalMutation({
  args: {
    contentAudioId: vv.id("contentAudios"),
  },
  returns: v.object({ scheduled: v.boolean() }),
  handler: async (ctx, args) => {
    await ctx.scheduler.runAfter(
      0,
      internal.audioStudies.actions.generateScript,
      {
        contentAudioId: args.contentAudioId,
      }
    );
    return { scheduled: true };
  },
});

/**
 * Schedule speech generation to run in the background.
 * Use this instead of calling generateSpeech directly to avoid CLI timeout.
 * The CLI returns immediately, and the action runs asynchronously.
 */
export const scheduleGenerateSpeech = internalMutation({
  args: {
    contentAudioId: vv.id("contentAudios"),
  },
  returns: v.object({ scheduled: v.boolean() }),
  handler: async (ctx, args) => {
    await ctx.scheduler.runAfter(
      0,
      internal.audioStudies.actions.generateSpeech,
      {
        contentAudioId: args.contentAudioId,
      }
    );
    return { scheduled: true };
  },
});

/**
 * Start the full audio generation workflow.
 * This workflow orchestrates both script and speech generation.
 * Use this for end-to-end testing of the complete pipeline.
 */
export const startWorkflow = internalMutation({
  args: {
    contentAudioId: vv.id("contentAudios"),
  },
  returns: v.object({ workflowId: v.string() }),
  handler: async (ctx, args) => {
    // Start workflow using the workflow manager's start function
    // This creates a durable workflow execution that survives crashes
    const workflowId: WorkflowId = await workflow.start(
      ctx,
      internal.audioStudies.workflows.generateAudio,
      {
        contentAudioId: args.contentAudioId,
      }
    );
    return { workflowId };
  },
});
