import { defineTable, paginationResultValidator } from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import {
  addFieldsToValidator,
  literals,
  nullable,
  systemFields,
} from "convex-helpers/validators";

/**
 * School class member role validator
 */
export const schoolClassMemberRoleValidator = literals("teacher", "student");
export type SchoolClassMemberRole = Infer<
  typeof schoolClassMemberRoleValidator
>;

/**
 * School class teacher role validator
 */
export const schoolClassTeacherRoleValidator = v.optional(
  literals("primary", "co-teacher", "assistant")
);
export type SchoolClassTeacherRole = Infer<
  typeof schoolClassTeacherRoleValidator
>;

/**
 * School class enroll method validator
 */
export const schoolClassEnrollMethodValidator = v.optional(
  literals("code", "teacher", "admin", "invite", "public")
);
export type SchoolClassEnrollMethod = Infer<
  typeof schoolClassEnrollMethodValidator
>;

/**
 * School class visibility validator
 */
export const schoolClassVisibilityValidator = literals("private", "public");
export type SchoolClassVisibility = Infer<
  typeof schoolClassVisibilityValidator
>;

/**
 * Class material status validator
 */
export const schoolClassMaterialStatusValidator = literals(
  "draft",
  "published",
  "scheduled",
  "archived"
);
export type SchoolClassMaterialStatus = Infer<
  typeof schoolClassMaterialStatusValidator
>;

/**
 * Class images validator
 */
export const schoolClassImageValidator = literals(
  "retro",
  "time",
  "stars",
  "chill",
  "puzzle",
  "line",
  "shoot",
  "virus",
  "bacteria",
  "cooking",
  "disco",
  "logic",
  "ball",
  "duck",
  "music",
  "nightly",
  "writer",
  "barbie",
  "fun",
  "lamp",
  "lemon",
  "nighty",
  "rocket",
  "sakura",
  "sky",
  "stamp",
  "vintage"
);
export type SchoolClassImage = Infer<typeof schoolClassImageValidator>;

/**
 * Forum tag validator
 */
export const schoolClassForumTagValidator = literals(
  "general",
  "question",
  "announcement",
  "assignment",
  "resource"
);
export type SchoolClassForumTag = Infer<typeof schoolClassForumTagValidator>;

/**
 * Forum status validator
 */
export const schoolClassForumStatusValidator = literals(
  "open",
  "locked",
  "archived"
);
export type SchoolClassForumStatus = Infer<
  typeof schoolClassForumStatusValidator
>;

/**
 * Reaction count validator
 */
export const schoolClassReactionCountValidator = v.object({
  emoji: v.string(),
  count: v.number(),
});

/**
 * School class base validator (without system fields)
 */
export const schoolClassValidator = v.object({
  schoolId: v.id("schools"),
  name: v.string(),
  subject: v.string(),
  year: v.string(),
  image: schoolClassImageValidator,
  isArchived: v.boolean(),
  visibility: schoolClassVisibilityValidator,
  studentCount: v.number(),
  teacherCount: v.number(),
  updatedAt: v.number(),
  createdBy: v.id("users"),
  updatedBy: v.optional(v.id("users")),
  archivedBy: v.optional(v.id("users")),
  archivedAt: v.optional(v.number()),
});

/**
 * School class document validator (with system fields)
 */
export const schoolClassDocValidator = addFieldsToValidator(
  schoolClassValidator,
  systemFields("schoolClasses")
);
export type SchoolClassDoc = Infer<typeof schoolClassDocValidator>;

/**
 * Paginated classes validator
 */
export const paginatedClassesValidator = paginationResultValidator(
  schoolClassDocValidator
);

/**
 * School class member base validator (without system fields)
 */
export const schoolClassMemberValidator = v.object({
  classId: v.id("schoolClasses"),
  userId: v.id("users"),
  schoolId: v.id("schools"),
  role: schoolClassMemberRoleValidator,
  teacherRole: schoolClassTeacherRoleValidator,
  enrollMethod: schoolClassEnrollMethodValidator,
  inviteCodeId: v.optional(v.id("schoolClassInviteCodes")),
  updatedAt: v.number(),
  addedBy: v.optional(v.id("users")),
  removedBy: v.optional(v.id("users")),
  removedAt: v.optional(v.number()),
});

/**
 * School class member document validator (with system fields)
 */
export const schoolClassMemberDocValidator = addFieldsToValidator(
  schoolClassMemberValidator,
  systemFields("schoolClassMembers")
);
export type SchoolClassMemberDoc = Infer<typeof schoolClassMemberDocValidator>;

/**
 * School class invite code base validator (without system fields)
 */
export const schoolClassInviteCodeValidator = v.object({
  classId: v.id("schoolClasses"),
  schoolId: v.id("schools"),
  role: schoolClassMemberRoleValidator,
  code: v.string(),
  enabled: v.boolean(),
  expiresAt: v.optional(v.number()),
  maxUsage: v.optional(v.number()),
  currentUsage: v.number(),
  description: v.optional(v.string()),
  createdBy: v.id("users"),
  updatedBy: v.optional(v.id("users")),
  updatedAt: v.number(),
});

/**
 * School class forum base validator (without system fields)
 */
export const schoolClassForumValidator = v.object({
  classId: v.id("schoolClasses"),
  schoolId: v.id("schools"),
  title: v.string(),
  body: v.string(),
  tag: schoolClassForumTagValidator,
  status: schoolClassForumStatusValidator,
  isPinned: v.boolean(),
  postCount: v.number(),
  participantCount: v.number(),
  reactionCounts: v.array(schoolClassReactionCountValidator),
  lastPostAt: v.number(),
  lastPostBy: v.optional(v.id("users")),
  createdBy: v.id("users"),
  updatedAt: v.number(),
});

/**
 * School class forum post base validator (without system fields)
 */
export const schoolClassForumPostValidator = v.object({
  forumId: v.id("schoolClassForums"),
  classId: v.id("schoolClasses"),
  body: v.string(),
  mentions: v.array(v.id("users")),
  parentId: v.optional(v.id("schoolClassForumPosts")),
  replyToUserId: v.optional(v.id("users")),
  replyToBody: v.optional(v.string()),
  replyCount: v.number(),
  reactionCounts: v.array(schoolClassReactionCountValidator),
  isDeleted: v.boolean(),
  createdBy: v.id("users"),
  updatedAt: v.number(),
  editedAt: v.optional(v.number()),
});

/**
 * School class material group base validator (without system fields)
 */
export const schoolClassMaterialGroupValidator = v.object({
  classId: v.id("schoolClasses"),
  schoolId: v.id("schools"),
  name: v.string(),
  description: v.string(),
  parentId: v.optional(v.id("schoolClassMaterialGroups")),
  order: v.number(),
  status: schoolClassMaterialStatusValidator,
  scheduledAt: v.optional(v.number()),
  scheduledJobId: v.optional(v.id("_scheduled_functions")),
  materialCount: v.number(),
  childGroupCount: v.number(),
  createdBy: v.id("users"),
  updatedAt: v.number(),
  publishedAt: v.optional(v.number()),
  publishedBy: v.optional(v.id("users")),
});

/**
 * Class info validator (for public info without auth)
 */
export const classInfoValidator = nullable(
  v.object({
    name: v.string(),
    subject: v.string(),
    year: v.string(),
    image: schoolClassImageValidator,
    visibility: schoolClassVisibilityValidator,
  })
);

/**
 * User data validator (for joined user info in class members)
 */
export const classMemberUserValidator = v.object({
  _id: v.id("users"),
  name: v.string(),
  email: v.string(),
  image: v.optional(nullable(v.string())),
});

/**
 * Class member with user data validator (for getPeople)
 */
export const classMemberWithUserValidator =
  schoolClassMemberDocValidator.extend({
    user: classMemberUserValidator,
  });
export type ClassMemberWithUser = Infer<typeof classMemberWithUserValidator>;

/**
 * Paginated people validator (for getPeople query)
 */
export const paginatedPeopleValidator = paginationResultValidator(
  classMemberWithUserValidator
);

const tables = {
  schoolClasses: defineTable(schoolClassValidator)
    .index("schoolId_isArchived_visibility", [
      "schoolId",
      "isArchived",
      "visibility",
    ])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["schoolId", "isArchived", "visibility"],
    }),

  schoolClassMembers: defineTable(schoolClassMemberValidator)
    .index("classId_userId", ["classId", "userId"])
    .index("userId", ["userId"])
    .index("schoolId", ["schoolId"]),

  schoolClassInviteCodes: defineTable(schoolClassInviteCodeValidator)
    .index("classId_role", ["classId", "role"])
    .index("code", ["code"])
    .index("schoolId", ["schoolId"]),

  schoolClassForums: defineTable(schoolClassForumValidator)
    .index("classId_status_lastPostAt", ["classId", "status", "lastPostAt"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["classId", "status"],
    }),

  schoolClassForumReactions: defineTable({
    forumId: v.id("schoolClassForums"),
    userId: v.id("users"),
    emoji: v.string(),
  }).index("forumId_userId_emoji", ["forumId", "userId", "emoji"]),

  schoolClassForumPosts: defineTable(schoolClassForumPostValidator).index(
    "forumId",
    ["forumId"]
  ),

  schoolClassForumPostAttachments: defineTable({
    postId: v.id("schoolClassForumPosts"),
    forumId: v.id("schoolClassForums"),
    classId: v.id("schoolClasses"),
    name: v.string(),
    fileId: v.id("_storage"),
    mimeType: v.string(),
    size: v.number(),
    createdBy: v.id("users"),
  }).index("postId", ["postId"]),

  schoolClassForumPostReactions: defineTable({
    postId: v.id("schoolClassForumPosts"),
    userId: v.id("users"),
    emoji: v.string(),
  }).index("postId_userId_emoji", ["postId", "userId", "emoji"]),

  schoolClassForumReadStates: defineTable({
    forumId: v.id("schoolClassForums"),
    classId: v.id("schoolClasses"),
    userId: v.id("users"),
    lastReadAt: v.number(),
  })
    .index("forumId_userId", ["forumId", "userId"])
    .index("classId_userId", ["classId", "userId"]),

  schoolClassMaterialGroups: defineTable(schoolClassMaterialGroupValidator)
    .index("classId_parentId_order", ["classId", "parentId", "order"])
    .index("classId_parentId_status_order", [
      "classId",
      "parentId",
      "status",
      "order",
    ])
    .index("status_scheduledAt", ["status", "scheduledAt"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["classId", "status"],
    }),

  schoolClassMaterials: defineTable({
    groupId: v.id("schoolClassMaterialGroups"),
    classId: v.id("schoolClasses"),
    schoolId: v.id("schools"),
    title: v.string(),
    body: v.optional(v.string()),
    bodyPlainText: v.optional(v.string()),
    order: v.number(),
    status: schoolClassMaterialStatusValidator,
    scheduledAt: v.optional(v.number()),
    isPinned: v.boolean(),
    attachmentCount: v.number(),
    viewCount: v.number(),
    downloadCount: v.number(),
    totalFileSize: v.number(),
    createdBy: v.id("users"),
    updatedAt: v.number(),
    publishedAt: v.optional(v.number()),
    publishedBy: v.optional(v.id("users")),
  })
    .index("groupId_status_isPinned_order", [
      "groupId",
      "status",
      "isPinned",
      "order",
    ])
    .index("status_scheduledAt", ["status", "scheduledAt"])
    .index("classId_status", ["classId", "status"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["classId", "groupId", "status"],
    })
    .searchIndex("search_body", {
      searchField: "bodyPlainText",
      filterFields: ["classId", "groupId", "status"],
    }),

  schoolClassMaterialAttachments: defineTable({
    materialId: v.id("schoolClassMaterials"),
    groupId: v.id("schoolClassMaterialGroups"),
    classId: v.id("schoolClasses"),
    fileId: v.id("_storage"),
    name: v.string(),
    mimeType: v.string(),
    size: v.number(),
    type: literals("inline", "download"),
    order: v.number(),
    downloadCount: v.number(),
    uploadedBy: v.id("users"),
  })
    .index("materialId_type_order", ["materialId", "type", "order"])
    .index("classId", ["classId"]),

  schoolClassMaterialViews: defineTable({
    materialId: v.id("schoolClassMaterials"),
    classId: v.id("schoolClasses"),
    userId: v.id("users"),
    firstViewedAt: v.number(),
    lastViewedAt: v.number(),
    viewCount: v.number(),
    hasDownloaded: v.boolean(),
    lastDownloadedAt: v.optional(v.number()),
  })
    .index("materialId_userId", ["materialId", "userId"])
    .index("classId_userId", ["classId", "userId"]),
};

export default tables;
