import { defineTable } from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { TEACHER_PERMISSIONS } from "./constants";

const schoolClassMemberRoles = v.union(
  v.literal("teacher"),
  v.literal("student")
);
export type SchoolClassMemberRole = Infer<typeof schoolClassMemberRoles>;

const schoolClassVisibility = v.union(
  v.literal("private"),
  v.literal("public")
);
export type SchoolClassVisibility = Infer<typeof schoolClassVisibility>;

const tables = {
  schoolClasses: defineTable({
    schoolId: v.id("schools"),
    name: v.string(),
    subject: v.string(),
    year: v.string(),
    image: v.string(),
    isArchived: v.boolean(),
    // Visibility: "private" (invite code required) or "public" (anyone in school can join)
    visibility: schoolClassVisibility,
    studentCount: v.number(),
    teacherCount: v.number(),
    updatedAt: v.number(),
    createdBy: v.id("users"),
    updatedBy: v.optional(v.id("users")),
    archivedBy: v.optional(v.id("users")),
    archivedAt: v.optional(v.number()),
  })
    // Single compound index covers all query patterns:
    // - eq("schoolId") - all classes in school
    // - eq("schoolId").eq("isArchived", false) - non-archived classes
    // - eq("schoolId").eq("isArchived", false).eq("visibility", "public") - public classes
    .index("schoolId_isArchived_visibility", [
      "schoolId",
      "isArchived",
      "visibility",
    ])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["schoolId", "isArchived", "visibility"],
    }),

  schoolClassMembers: defineTable({
    classId: v.id("schoolClasses"),
    userId: v.id("users"),
    schoolId: v.id("schools"),
    role: schoolClassMemberRoles,
    teacherRole: v.optional(
      v.union(
        v.literal("primary"),
        v.literal("co-teacher"),
        v.literal("assistant")
      )
    ),
    teacherPermissions: v.optional(
      v.array(
        v.union(
          v.literal(TEACHER_PERMISSIONS.CLASS_MANAGE),
          v.literal(TEACHER_PERMISSIONS.CLASS_ARCHIVE),
          v.literal(TEACHER_PERMISSIONS.CLASS_DELETE),
          v.literal(TEACHER_PERMISSIONS.MEMBER_MANAGE),
          v.literal(TEACHER_PERMISSIONS.CONTENT_CREATE),
          v.literal(TEACHER_PERMISSIONS.CONTENT_EDIT),
          v.literal(TEACHER_PERMISSIONS.CONTENT_DELETE),
          v.literal(TEACHER_PERMISSIONS.CONTENT_PUBLISH),
          v.literal(TEACHER_PERMISSIONS.GRADE_VIEW),
          v.literal(TEACHER_PERMISSIONS.GRADE_SCORE),
          v.literal(TEACHER_PERMISSIONS.GRADE_SETUP),
          v.literal(TEACHER_PERMISSIONS.COMM_ANNOUNCE),
          v.literal(TEACHER_PERMISSIONS.COMM_MODERATE),
          v.literal(TEACHER_PERMISSIONS.COMM_MESSAGE),
          v.literal(TEACHER_PERMISSIONS.STATS_VIEW)
        )
      )
    ),
    enrollMethod: v.optional(
      v.union(
        v.literal("code"),
        v.literal("teacher"),
        v.literal("admin"),
        v.literal("invite"),
        v.literal("public") // Joined via public class listing
      )
    ),
    inviteCodeId: v.optional(v.id("schoolClassInviteCodes")),
    updatedAt: v.number(),
    addedBy: v.optional(v.id("users")),
    removedBy: v.optional(v.id("users")),
    removedAt: v.optional(v.number()),
  })
    // For membership lookup: eq("classId") OR eq("classId").eq("userId")
    .index("classId_userId", ["classId", "userId"])
    .index("userId", ["userId"])
    .index("schoolId", ["schoolId"]),

  schoolClassInviteCodes: defineTable({
    classId: v.id("schoolClasses"),
    schoolId: v.id("schools"),
    role: schoolClassMemberRoles,
    code: v.string(),
    enabled: v.boolean(),
    expiresAt: v.optional(v.number()),
    maxUsage: v.optional(v.number()),
    currentUsage: v.number(),
    description: v.optional(v.string()),
    createdBy: v.id("users"),
    updatedBy: v.optional(v.id("users")),
    updatedAt: v.number(),
  })
    // Use classId_role for all classId queries (can omit role condition)
    .index("classId_role", ["classId", "role"])
    .index("code", ["code"])
    .index("schoolId", ["schoolId"]),

  // FORUM: Main Threads (Topics)
  schoolClassForums: defineTable({
    classId: v.id("schoolClasses"),
    schoolId: v.id("schools"),
    title: v.string(),
    body: v.string(),
    tag: v.union(
      v.literal("general"),
      v.literal("question"),
      v.literal("announcement"),
      v.literal("assignment"),
      v.literal("resource")
    ),
    status: v.union(
      v.literal("open"),
      v.literal("locked"),
      v.literal("archived")
    ),
    isPinned: v.boolean(),
    postCount: v.number(),
    participantCount: v.number(),
    // Array of reactions - emoji as value (not key) to support non-ASCII characters
    reactionCounts: v.array(
      v.object({
        emoji: v.string(),
        count: v.number(),
      })
    ),
    lastPostAt: v.number(),
    lastPostBy: v.optional(v.id("users")),
    createdBy: v.id("users"),
    updatedAt: v.number(),
  })
    .index("classId_status_lastPostAt", ["classId", "status", "lastPostAt"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["classId", "status"],
    }),

  // FORUM: Reactions (Children of Forums/Threads) - Discord-style emoji reactions
  schoolClassForumReactions: defineTable({
    forumId: v.id("schoolClassForums"),
    userId: v.id("users"),
    emoji: v.string(), // Any emoji: "👍", "🎉", "❤️", "🔥", etc.
  })
    // Single index covers both use cases:
    // 1. Toggle: eq("forumId", x).eq("userId", y).eq("emoji", z)
    // 2. Get my reactions: eq("forumId", x).eq("userId", y)
    .index("forumId_userId_emoji", ["forumId", "userId", "emoji"]),

  // FORUM: Posts (Messages within a forum thread)
  schoolClassForumPosts: defineTable({
    forumId: v.id("schoolClassForums"),
    classId: v.id("schoolClasses"),
    body: v.string(),
    mentions: v.array(v.id("users")),
    parentId: v.optional(v.id("schoolClassForumPosts")),
    replyToUserId: v.optional(v.id("users")),
    // Denormalized preview of parent post (stored at reply time, like Discord)
    replyToBody: v.optional(v.string()),
    replyCount: v.number(),
    // Array of reactions - emoji as value (not key) to support non-ASCII characters
    reactionCounts: v.array(
      v.object({
        emoji: v.string(),
        count: v.number(),
      })
    ),
    isDeleted: v.boolean(),
    createdBy: v.id("users"),
    updatedAt: v.number(),
    editedAt: v.optional(v.number()),
  }).index("forumId", ["forumId"]),

  // FORUM: Attachments (Children of Posts)
  schoolClassForumPostAttachments: defineTable({
    postId: v.id("schoolClassForumPosts"),
    forumId: v.id("schoolClassForums"),
    classId: v.id("schoolClasses"),
    name: v.string(),
    type: v.union(v.literal("file"), v.literal("link")),
    fileId: v.optional(v.id("_storage")),
    url: v.optional(v.string()),
    size: v.optional(v.number()),
    createdBy: v.id("users"),
  }).index("postId", ["postId"]),

  // FORUM: Reactions (Children of Posts) - Discord-style emoji reactions
  schoolClassForumPostReactions: defineTable({
    postId: v.id("schoolClassForumPosts"),
    userId: v.id("users"),
    emoji: v.string(), // Any emoji: "👍", "🎉", "❤️", "🔥", etc.
  })
    // Single index covers both use cases:
    // 1. Toggle: eq("postId", x).eq("userId", y).eq("emoji", z)
    // 2. Get my reactions: eq("postId", x).eq("userId", y)
    .index("postId_userId_emoji", ["postId", "userId", "emoji"]),

  // FORUM: Read States (Children of Forums/Threads)
  // Note: Per-forum notification preferences use notificationPreferences.mutedEntities
  schoolClassForumReadStates: defineTable({
    forumId: v.id("schoolClassForums"),
    classId: v.id("schoolClasses"),
    userId: v.id("users"),
    lastReadAt: v.number(),
  })
    // For single forum read state lookup
    .index("forumId_userId", ["forumId", "userId"])
    // For batch fetching all read states in a class (Discord-style unread badges)
    .index("classId_userId", ["classId", "userId"]),
};

export default tables;
