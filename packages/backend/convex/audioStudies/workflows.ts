import { internal } from "@repo/backend/convex/_generated/api";
import { vv } from "@repo/backend/convex/lib/validators";
import { workflow } from "@repo/backend/convex/workflow";
import { v } from "convex/values";

/**
 * Durable workflow for audio generation pipeline.
 *
 * This workflow orchestrates:
 * 1. Generate podcast script using Gemini (AI SDK)
 * 2. Generate speech using ElevenLabs V3
 *
 * Benefits of using workflow:
 * - Survives server restarts and crashes
 * - Automatic retries on transient failures (e.g., API rate limits)
 * - Can be monitored, cancelled, or cleaned up
 * - Guaranteed exactly-once execution semantics
 * - Steps run in sequence (script must complete before speech generation)
 */
export const generateAudio = workflow.define({
  args: {
    contentAudioId: vv.id("contentAudios"),
  },
  returns: v.null(),
  handler: async (step, args) => {
    /**
     * Step 1: Generate podcast script.
     * Uses Gemini to create a conversational script with ElevenLabs V3 audio tags.
     * The script is saved to the database by the action.
     */
    await step.runAction(
      internal.audioStudies.actions.generateScript,
      {
        contentAudioId: args.contentAudioId,
      },
      {
        retry: true,
      }
    );

    /**
     * Step 2: Generate speech from script.
     * Uses ElevenLabs V3 to convert the script to audio.
     * This step only runs after script generation completes successfully.
     * The audio file is stored in Convex storage by the action.
     */
    await step.runAction(
      internal.audioStudies.actions.generateSpeech,
      {
        contentAudioId: args.contentAudioId,
      },
      {
        retry: true,
      }
    );

    return null;
  },
});
