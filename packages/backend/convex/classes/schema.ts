import { defineTable } from "convex/server";
import { v } from "convex/values";
import { TEACHER_PERMISSIONS } from "./constants";

const tables = {
  schoolClasses: defineTable({
    schoolId: v.id("schools"),
    name: v.string(),
    subject: v.string(),
    year: v.string(),
    image: v.string(),
    isArchived: v.boolean(),
    studentCount: v.number(),
    teacherCount: v.number(),
    updatedAt: v.number(),
    createdBy: v.id("users"),
    updatedBy: v.optional(v.id("users")),
    archivedBy: v.optional(v.id("users")),
    archivedAt: v.optional(v.number()),
  })
    .index("schoolId", ["schoolId"])
    .index("schoolId_isArchived", ["schoolId", "isArchived"])
    .index("createdBy", ["createdBy"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["schoolId", "isArchived"],
    }),

  schoolClassMembers: defineTable({
    classId: v.id("schoolClasses"),
    userId: v.id("users"),
    schoolId: v.id("schools"),
    role: v.union(v.literal("teacher"), v.literal("student")),
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
        v.literal("invite")
      )
    ),
    inviteCodeId: v.optional(v.id("schoolClassInviteCodes")),
    updatedAt: v.number(),
    addedBy: v.optional(v.id("users")),
    removedBy: v.optional(v.id("users")),
    removedAt: v.optional(v.number()),
  })
    .index("classId", ["classId"])
    .index("userId", ["userId"])
    .index("classId_userId", ["classId", "userId"])
    .index("classId_role", ["classId", "role"])
    .index("schoolId", ["schoolId"]),

  schoolClassInviteCodes: defineTable({
    classId: v.id("schoolClasses"),
    schoolId: v.id("schools"),
    role: v.union(v.literal("teacher"), v.literal("student")),
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
    .index("classId", ["classId"])
    .index("classId_role", ["classId", "role"])
    .index("code", ["code"])
    .index("classId_code", ["classId", "code"])
    .index("classId_enabled", ["classId", "enabled"])
    .index("schoolId", ["schoolId"]),

  // FORUM: Threads
  schoolClassForumThreads: defineTable({
    classId: v.id("schoolClasses"),
    schoolId: v.id("schools"),
    title: v.string(),
    body: v.optional(v.string()),
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

  // FORUM: Posts
  schoolClassForumPosts: defineTable({
    threadId: v.id("schoolClassForumThreads"),
    classId: v.id("schoolClasses"),
    body: v.string(),
    mentions: v.array(v.id("users")),
    parentId: v.optional(v.id("schoolClassForumPosts")),
    replyToUserId: v.optional(v.id("users")),
    replyCount: v.number(),
    reactionLikeCount: v.number(),
    reactionInsightfulCount: v.number(),
    reactionQuestionCount: v.number(),
    reactionCelebrateCount: v.number(),
    reactionResolvedCount: v.number(),
    isDeleted: v.boolean(),
    createdBy: v.id("users"),
    updatedAt: v.number(),
    editedAt: v.optional(v.number()),
  })
    .index("threadId", ["threadId"])
    .index("threadId_parentId", ["threadId", "parentId"])
    .index("createdBy", ["createdBy"]),

  // FORUM: Attachments (separate table for flat schema)
  schoolClassForumAttachments: defineTable({
    postId: v.id("schoolClassForumPosts"),
    threadId: v.id("schoolClassForumThreads"),
    classId: v.id("schoolClasses"),
    attachmentName: v.string(),
    attachmentType: v.union(v.literal("file"), v.literal("link")),
    attachmentFileId: v.optional(v.id("_storage")),
    attachmentUrl: v.optional(v.string()),
    attachmentSize: v.optional(v.number()),
    createdBy: v.id("users"),
  }).index("postId", ["postId"]),

  // FORUM: Reactions
  schoolClassForumReactions: defineTable({
    postId: v.id("schoolClassForumPosts"),
    userId: v.id("users"),
    reaction: v.union(
      v.literal("like"),
      v.literal("insightful"),
      v.literal("question"),
      v.literal("celebrate"),
      v.literal("resolved")
    ),
  })
    .index("postId_userId", ["postId", "userId"])
    .index("userId", ["userId"]),

  // FORUM: Read States
  schoolClassForumReadStates: defineTable({
    threadId: v.id("schoolClassForumThreads"),
    classId: v.id("schoolClasses"),
    userId: v.id("users"),
    lastReadAt: v.number(),
    notification: v.union(
      v.literal("all"),
      v.literal("mentions"),
      v.literal("muted")
    ),
  })
    .index("threadId_userId", ["threadId", "userId"])
    .index("userId_notification", ["userId", "notification"]),
};

export default tables;
