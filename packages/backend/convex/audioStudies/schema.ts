import {
  audioStatusValidator,
  localeValidator,
} from "@repo/backend/convex/lib/contentValidators";
import { vv } from "@repo/backend/convex/lib/validators";
import { defineTable } from "convex/server";
import { v } from "convex/values";

const tables = {
  contentAudios: defineTable({
    contentId: v.union(vv.id("articleContents"), vv.id("subjectSections")),
    contentType: v.union(v.literal("article"), v.literal("subject")),
    locale: localeValidator,
    contentHash: v.string(),
    voiceId: v.string(),
    voiceSettings: v.optional(
      v.object({
        stability: v.optional(v.number()),
        similarityBoost: v.optional(v.number()),
        style: v.optional(v.number()),
        useSpeakerBoost: v.optional(v.boolean()),
      })
    ),
    status: audioStatusValidator,
    script: v.optional(v.string()),
    audioStorageId: v.optional(vv.id("_storage")),
    audioDuration: v.optional(v.number()),
    audioSize: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    failedAt: v.optional(v.number()),
    generationAttempts: v.number(),
    updatedAt: v.number(),
  })
    .index("content_voice", ["contentId", "contentType", "voiceId"])
    .index("content", ["contentId", "contentType"])
    .index("status", ["status"]),

  userContentAudios: defineTable({
    userId: vv.id("users"),
    contentAudioId: vv.id("contentAudios"),
    contentId: v.union(vv.id("articleContents"), vv.id("subjectSections")),
    contentType: v.union(v.literal("article"), v.literal("subject")),
    playCount: v.number(),
    lastPlayedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("user", ["userId"])
    .index("user_content", ["userId", "contentId", "contentType"])
    .index("contentAudio", ["contentAudioId"]),
};

export default tables;
