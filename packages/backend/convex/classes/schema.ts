import { defineTable, paginationResultValidator } from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";

/**
 * Class member role validator
 */
export const classMemberRoleValidator = v.union(
  v.literal("teacher"),
  v.literal("student")
);
export type ClassMemberRole = Infer<typeof classMemberRoleValidator>;

/**
 * Teacher role validator (for teachers in a class)
 */
export const classTeacherRoleValidator = v.optional(
  v.union(v.literal("primary"), v.literal("co-teacher"), v.literal("assistant"))
);
export type ClassTeacherRole = Infer<typeof classTeacherRoleValidator>;

/**
 * Enroll method validator
 */
export const classEnrollMethodValidator = v.optional(
  v.union(
    v.literal("code"),
    v.literal("teacher"),
    v.literal("admin"),
    v.literal("invite"),
    v.literal("public")
  )
);
export type ClassEnrollMethod = Infer<typeof classEnrollMethodValidator>;

/**
 * Class visibility validator
 */
export const schoolClassVisibility = v.union(
  v.literal("private"),
  v.literal("public")
);
export type SchoolClassVisibility = Infer<typeof schoolClassVisibility>;

/**
 * Class material status validator
 */
export const schoolClassMaterialStatus = v.union(
  v.literal("draft"),
  v.literal("published"),
  v.literal("scheduled"),
  v.literal("archived")
);
export type SchoolClassMaterialStatus = Infer<typeof schoolClassMaterialStatus>;

/**
 * Class images validator
 */
export const schoolClassImages = v.union(
  v.literal("retro"),
  v.literal("time"),
  v.literal("stars"),
  v.literal("chill"),
  v.literal("puzzle"),
  v.literal("line"),
  v.literal("shoot"),
  v.literal("virus"),
  v.literal("bacteria"),
  v.literal("cooking"),
  v.literal("disco"),
  v.literal("logic"),
  v.literal("ball"),
  v.literal("duck"),
  v.literal("music"),
  v.literal("nightly"),
  v.literal("writer"),
  v.literal("barbie"),
  v.literal("fun"),
  v.literal("lamp"),
  v.literal("lemon"),
  v.literal("nighty"),
  v.literal("rocket"),
  v.literal("sakura"),
  v.literal("sky"),
  v.literal("stamp"),
  v.literal("vintage")
);
export type SchoolClassImage = Infer<typeof schoolClassImages>;

/**
 * Forum tag validator
 */
export const forumTagValidator = v.union(
  v.literal("general"),
  v.literal("question"),
  v.literal("announcement"),
  v.literal("assignment"),
  v.literal("resource")
);
export type ForumTag = Infer<typeof forumTagValidator>;

/**
 * Forum status validator
 */
export const forumStatusValidator = v.union(
  v.literal("open"),
  v.literal("locked"),
  v.literal("archived")
);
export type ForumStatus = Infer<typeof forumStatusValidator>;

/**
 * Reaction count validator
 */
export const reactionCountValidator = v.object({
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
  image: schoolClassImages,
  isArchived: v.boolean(),
  visibility: schoolClassVisibility,
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
export const schoolClassDocValidator = schoolClassValidator.extend({
  _id: v.id("schoolClasses"),
  _creationTime: v.number(),
});
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
  role: classMemberRoleValidator,
  teacherRole: classTeacherRoleValidator,
  enrollMethod: classEnrollMethodValidator,
  inviteCodeId: v.optional(v.id("schoolClassInviteCodes")),
  updatedAt: v.number(),
  addedBy: v.optional(v.id("users")),
  removedBy: v.optional(v.id("users")),
  removedAt: v.optional(v.number()),
});

/**
 * School class member document validator (with system fields)
 */
export const schoolClassMemberDocValidator = schoolClassMemberValidator.extend({
  _id: v.id("schoolClassMembers"),
  _creationTime: v.number(),
});
export type SchoolClassMemberDoc = Infer<typeof schoolClassMemberDocValidator>;

/**
 * School class invite code base validator (without system fields)
 */
export const schoolClassInviteCodeValidator = v.object({
  classId: v.id("schoolClasses"),
  schoolId: v.id("schools"),
  role: classMemberRoleValidator,
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
 * School class invite code document validator (with system fields)
 */
export const schoolClassInviteCodeDocValidator =
  schoolClassInviteCodeValidator.extend({
    _id: v.id("schoolClassInviteCodes"),
    _creationTime: v.number(),
  });
export type SchoolClassInviteCodeDoc = Infer<
  typeof schoolClassInviteCodeDocValidator
>;

/**
 * School class forum base validator (without system fields)
 */
export const schoolClassForumValidator = v.object({
  classId: v.id("schoolClasses"),
  schoolId: v.id("schools"),
  title: v.string(),
  body: v.string(),
  tag: forumTagValidator,
  status: forumStatusValidator,
  isPinned: v.boolean(),
  postCount: v.number(),
  participantCount: v.number(),
  reactionCounts: v.array(reactionCountValidator),
  lastPostAt: v.number(),
  lastPostBy: v.optional(v.id("users")),
  createdBy: v.id("users"),
  updatedAt: v.number(),
});

/**
 * School class forum document validator (with system fields)
 */
export const schoolClassForumDocValidator = schoolClassForumValidator.extend({
  _id: v.id("schoolClassForums"),
  _creationTime: v.number(),
});
export type SchoolClassForumDoc = Infer<typeof schoolClassForumDocValidator>;

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
  reactionCounts: v.array(reactionCountValidator),
  isDeleted: v.boolean(),
  createdBy: v.id("users"),
  updatedAt: v.number(),
  editedAt: v.optional(v.number()),
});

/**
 * School class forum post document validator (with system fields)
 */
export const schoolClassForumPostDocValidator =
  schoolClassForumPostValidator.extend({
    _id: v.id("schoolClassForumPosts"),
    _creationTime: v.number(),
  });
export type SchoolClassForumPostDoc = Infer<
  typeof schoolClassForumPostDocValidator
>;

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
  status: schoolClassMaterialStatus,
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
 * School class material group document validator (with system fields)
 */
export const schoolClassMaterialGroupDocValidator =
  schoolClassMaterialGroupValidator.extend({
    _id: v.id("schoolClassMaterialGroups"),
    _creationTime: v.number(),
  });
export type SchoolClassMaterialGroupDoc = Infer<
  typeof schoolClassMaterialGroupDocValidator
>;

/**
 * Class info validator (for public info without auth)
 */
export const classInfoValidator = v.union(
  v.null(),
  v.object({
    name: v.string(),
    subject: v.string(),
    year: v.string(),
    image: schoolClassImages,
    visibility: schoolClassVisibility,
  })
);

/**
 * User data validator (for joined user info in class members)
 */
export const classMemberUserValidator = v.object({
  _id: v.id("users"),
  name: v.string(),
  email: v.string(),
  image: v.optional(v.union(v.string(), v.null())),
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
    status: schoolClassMaterialStatus,
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
    type: v.union(v.literal("inline"), v.literal("download")),
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
