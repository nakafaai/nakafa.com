import { defineTable } from "convex/server";
import { v } from "convex/values";

const tables = {
  accountDeletionPreparations: defineTable({
    attemptId: v.optional(v.string()),
    authId: v.string(),
    finalizedAt: v.optional(v.number()),
    pendingSchoolId: v.optional(v.id("schools")),
    pendingSchoolNextCursor: v.optional(v.string()),
    readyAt: v.optional(v.number()),
    recoveryAt: v.optional(v.number()),
    recoveryGeneration: v.number(),
    schoolCursor: v.optional(v.string()),
    successorCursor: v.optional(v.string()),
    userId: v.id("users"),
  })
    .index("by_attemptId", ["attemptId"])
    .index("by_authId", ["authId"])
    .index("by_recoveryAt", ["recoveryAt"])
    .index("by_userId", ["userId"]),
  accountDeletionReceipts: defineTable({
    attemptId: v.string(),
    committedAt: v.number(),
  })
    .index("by_attemptId", ["attemptId"])
    .index("by_committedAt", ["committedAt"]),
  accountDeletionSchoolTransfers: defineTable({
    preparationId: v.id("accountDeletionPreparations"),
    schoolId: v.id("schools"),
    successorMembershipId: v.id("schoolMembers"),
    successorCursor: v.optional(v.string()),
    successorUserId: v.id("users"),
  })
    .index("by_preparationId", ["preparationId"])
    .index("by_successorUserId", ["successorUserId"]),
};

export default tables;
