import {
  modelBuildBaseValidator,
  modelBuildPhaseValidator,
  modelBuildSlotsValidator,
} from "@repo/backend/convex/contentRelease/models/spec";
import { defineTable } from "convex/server";
import { v } from "convex/values";

const tables = {
  /** One crash-safe inactive-buffer build removed by atomic activation. */
  contentModelBuilds: defineTable({
    base: modelBuildBaseValidator,
    cursor: v.optional(v.string()),
    generation: v.number(),
    itemIndex: v.number(),
    key: v.literal("primary"),
    manifestHash: v.string(),
    phase: modelBuildPhaseValidator,
    releaseId: v.string(),
    sequence: v.number(),
    slots: modelBuildSlotsValidator,
    syncJobId: v.optional(v.id("_scheduled_functions")),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
};

export default tables;
