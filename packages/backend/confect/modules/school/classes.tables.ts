import { GenericId } from "@confect/core";
import { Table } from "@confect/server";
import { Schema } from "effect";

/**
 * School class member role validator
 */
export const schoolClassMemberRoleSchema = Schema.Literal("teacher", "student");

export type SchoolClassMemberRole = Schema.Schema.Type<
  typeof schoolClassMemberRoleSchema
>;

/**
 * School class teacher role validator (base type without optional wrapper)
 */
export const schoolClassTeacherRoleBaseSchema = Schema.Literal(
  "primary",
  "co-teacher",
  "assistant"
);

export type SchoolClassTeacherRole = Schema.Schema.Type<
  typeof schoolClassTeacherRoleBaseSchema
>;

/**
 * School class teacher role validator (with optional wrapper for schema use)
 */
export const schoolClassTeacherRoleSchema = Schema.optional(
  schoolClassTeacherRoleBaseSchema
);

/**
 * School class enroll method validator
 */
export const schoolClassEnrollMethodSchema = Schema.optional(
  Schema.Literal("by_code", "teacher", "admin", "invite", "public")
);

/**
 * School class visibility validator
 */
export const schoolClassVisibilitySchema = Schema.Literal("private", "public");

export type SchoolClassVisibility = Schema.Schema.Type<
  typeof schoolClassVisibilitySchema
>;

/**
 * Class material status validator
 */
export const schoolClassMaterialStatusSchema = Schema.Literal(
  "draft",
  "published",
  "scheduled",
  "archived"
);

export type SchoolClassMaterialStatus = Schema.Schema.Type<
  typeof schoolClassMaterialStatusSchema
>;

/**
 * Class images validator
 */
export const schoolClassImageSchema = Schema.Literal(
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

export type SchoolClassImage = Schema.Schema.Type<
  typeof schoolClassImageSchema
>;

/**
 * Forum tag validator
 */
export const schoolClassForumTagSchema = Schema.Literal(
  "general",
  "question",
  "announcement",
  "assignment",
  "resource"
);

export type SchoolClassForumTag = Schema.Schema.Type<
  typeof schoolClassForumTagSchema
>;

/**
 * Forum status validator
 */
export const schoolClassForumStatusSchema = Schema.Literal(
  "open",
  "locked",
  "archived"
);

/**
 * Reaction count validator
 */
export const schoolClassReactionCountSchema = Schema.Struct({
  emoji: Schema.String,
  count: Schema.Number,
});

/**
 * School class base validator (without system fields)
 */
export const schoolClassSchema = Schema.Struct({
  schoolId: GenericId.GenericId("schools"),
  name: Schema.String,
  subject: Schema.String,
  year: Schema.String,
  image: schoolClassImageSchema,
  isArchived: Schema.Boolean,
  visibility: schoolClassVisibilitySchema,
  studentCount: Schema.Number,
  teacherCount: Schema.Number,
  updatedAt: Schema.Number,
  createdBy: GenericId.GenericId("users"),
  updatedBy: Schema.optional(GenericId.GenericId("users")),
  archivedBy: Schema.optional(GenericId.GenericId("users")),
  archivedAt: Schema.optional(Schema.Number),
});

/**
 * School class member base validator (without system fields)
 */
export const schoolClassMemberSchema = Schema.Struct({
  classId: GenericId.GenericId("schoolClasses"),
  userId: GenericId.GenericId("users"),
  schoolId: GenericId.GenericId("schools"),
  role: schoolClassMemberRoleSchema,
  teacherRole: schoolClassTeacherRoleSchema,
  enrollMethod: schoolClassEnrollMethodSchema,
  inviteCodeId: Schema.optional(GenericId.GenericId("schoolClassInviteCodes")),
  updatedAt: Schema.Number,
  addedBy: Schema.optional(GenericId.GenericId("users")),
  removedBy: Schema.optional(GenericId.GenericId("users")),
  removedAt: Schema.optional(Schema.Number),
});

/**
 * School class invite code base validator (without system fields)
 */
export const schoolClassInviteCodeSchema = Schema.Struct({
  classId: GenericId.GenericId("schoolClasses"),
  schoolId: GenericId.GenericId("schools"),
  role: schoolClassMemberRoleSchema,
  code: Schema.String,
  enabled: Schema.Boolean,
  expiresAt: Schema.optional(Schema.Number),
  maxUsage: Schema.optional(Schema.Number),
  currentUsage: Schema.Number,
  description: Schema.optional(Schema.String),
  createdBy: GenericId.GenericId("users"),
  updatedBy: Schema.optional(GenericId.GenericId("users")),
  updatedAt: Schema.Number,
});

/**
 * Stored forum thread state, including denormalized counters used by the class
 * forum list and conversation sheet.
 */
export const schoolClassForumSchema = Schema.Struct({
  classId: GenericId.GenericId("schoolClasses"),
  schoolId: GenericId.GenericId("schools"),
  title: Schema.String,
  body: Schema.String,
  tag: schoolClassForumTagSchema,
  status: schoolClassForumStatusSchema,
  isPinned: Schema.Boolean,
  postCount: Schema.Number,
  nextPostSequence: Schema.Number,
  reactionCounts: Schema.Array(schoolClassReactionCountSchema),
  lastPostAt: Schema.Number,
  lastPostBy: Schema.optional(GenericId.GenericId("users")),
  createdBy: GenericId.GenericId("users"),
  updatedAt: Schema.Number,
});

/**
 * Stored forum post state, including read-boundary reply metadata and
 * denormalized reaction counts.
 */
export const schoolClassForumPostSchema = Schema.Struct({
  forumId: GenericId.GenericId("schoolClassForums"),
  classId: GenericId.GenericId("schoolClasses"),
  body: Schema.String,
  mentions: Schema.Array(GenericId.GenericId("users")),
  parentId: Schema.optional(GenericId.GenericId("schoolClassForumPosts")),
  replyToUserId: Schema.optional(GenericId.GenericId("users")),
  replyToBody: Schema.optional(Schema.String),
  replyCount: Schema.Number,
  reactionCounts: Schema.Array(schoolClassReactionCountSchema),
  sequence: Schema.Number,
  createdBy: GenericId.GenericId("users"),
  updatedAt: Schema.Number,
  editedAt: Schema.optional(Schema.Number),
});

/**
 * School class material group base validator (without system fields)
 */
export const schoolClassMaterialGroupSchema = Schema.Struct({
  classId: GenericId.GenericId("schoolClasses"),
  schoolId: GenericId.GenericId("schools"),
  name: Schema.String,
  description: Schema.String,
  parentId: Schema.optional(GenericId.GenericId("schoolClassMaterialGroups")),
  order: Schema.Number,
  status: schoolClassMaterialStatusSchema,
  scheduledAt: Schema.optional(Schema.Number),
  scheduledJobId: Schema.optional(GenericId.GenericId("_scheduled_functions")),
  materialCount: Schema.Number,
  childGroupCount: Schema.Number,
  createdBy: GenericId.GenericId("users"),
  updatedAt: Schema.Number,
  publishedAt: Schema.optional(Schema.Number),
  publishedBy: Schema.optional(GenericId.GenericId("users")),
});

/**
 * User data validator (for joined user info in class members)
 */
const _classMemberUserSchema = Schema.Struct({
  _id: GenericId.GenericId("users"),
  name: Schema.String,
  email: Schema.String,
  image: Schema.optional(Schema.NullOr(Schema.String)),
});

/** schoolClasses table definition. */
export const SchoolClasses = Table.make("schoolClasses", schoolClassSchema)
  .index("by_schoolId_and_isArchived_and_visibility", [
    "schoolId",
    "isArchived",
    "visibility",
  ])
  .index("by_schoolId_and_visibility_and_isArchived", [
    "schoolId",
    "visibility",
    "isArchived",
  ])
  .searchIndex("search_name", {
    searchField: "name",
    filterFields: ["schoolId", "isArchived", "visibility"],
  });

/** schoolClassMembers table definition. */
export const SchoolClassMembers = Table.make(
  "schoolClassMembers",
  schoolClassMemberSchema
)
  .index("by_classId_and_userId", ["classId", "userId"])
  .index("by_schoolId", ["schoolId"]);

/** schoolClassInviteCodes table definition. */
export const SchoolClassInviteCodes = Table.make(
  "schoolClassInviteCodes",
  schoolClassInviteCodeSchema
)
  .index("by_classId_and_role", ["classId", "role"])
  .index("by_code", ["code"])
  .index("by_schoolId", ["schoolId"]);

/** schoolClassForums table definition. */
export const SchoolClassForums = Table.make(
  "schoolClassForums",
  schoolClassForumSchema
)
  .index("by_classId_and_lastPostAt", ["classId", "lastPostAt"])
  .index("by_classId_and_status_and_lastPostAt", [
    "classId",
    "status",
    "lastPostAt",
  ])
  .searchIndex("search_title", {
    searchField: "title",
    filterFields: ["classId", "status"],
  });

/** schoolClassForumReactions table definition. */
export const SchoolClassForumReactions = Table.make(
  "schoolClassForumReactions",
  Schema.Struct({
    forumId: GenericId.GenericId("schoolClassForums"),
    userId: GenericId.GenericId("users"),
    emoji: Schema.String,
  })
)
  .index("by_forumId_and_userId_and_emoji", ["forumId", "userId", "emoji"])
  .index("by_forumId_and_emoji_and_userId", ["forumId", "emoji", "userId"]);

/** schoolClassForumPosts table definition. */
export const SchoolClassForumPosts = Table.make(
  "schoolClassForumPosts",
  schoolClassForumPostSchema
)
  .index("by_forumId", ["forumId"])
  .index("by_forumId_and_sequence", ["forumId", "sequence"]);

/** schoolClassForumPendingUploads table definition. */
export const SchoolClassForumPendingUploads = Table.make(
  "schoolClassForumPendingUploads",
  Schema.Struct({
    forumId: GenericId.GenericId("schoolClassForums"),
    classId: GenericId.GenericId("schoolClasses"),
    uploadedBy: GenericId.GenericId("users"),
    storageId: Schema.optional(GenericId.GenericId("_storage")),
    name: Schema.optional(Schema.String),
    mimeType: Schema.optional(Schema.String),
    size: Schema.optional(Schema.Number),
  })
)
  .index("by_storageId", ["storageId"])
  .index("by_forumId_and_uploadedBy", ["forumId", "uploadedBy"]);

/** schoolClassForumPostAttachments table definition. */
export const SchoolClassForumPostAttachments = Table.make(
  "schoolClassForumPostAttachments",
  Schema.Struct({
    postId: GenericId.GenericId("schoolClassForumPosts"),
    forumId: GenericId.GenericId("schoolClassForums"),
    classId: GenericId.GenericId("schoolClasses"),
    name: Schema.String,
    fileId: GenericId.GenericId("_storage"),
    mimeType: Schema.String,
    size: Schema.Number,
    createdBy: GenericId.GenericId("users"),
  })
)
  .index("by_postId", ["postId"])
  .index("by_fileId", ["fileId"]);

/** schoolClassForumPostReactions table definition. */
export const SchoolClassForumPostReactions = Table.make(
  "schoolClassForumPostReactions",
  Schema.Struct({
    postId: GenericId.GenericId("schoolClassForumPosts"),
    userId: GenericId.GenericId("users"),
    emoji: Schema.String,
  })
)
  .index("by_postId_and_userId_and_emoji", ["postId", "userId", "emoji"])
  .index("by_postId_and_emoji_and_userId", ["postId", "emoji", "userId"]);

/** schoolClassForumReadStates table definition. */
export const SchoolClassForumReadStates = Table.make(
  "schoolClassForumReadStates",
  Schema.Struct({
    forumId: GenericId.GenericId("schoolClassForums"),
    classId: GenericId.GenericId("schoolClasses"),
    userId: GenericId.GenericId("users"),
    lastReadSequence: Schema.Number,
  })
)
  .index("by_forumId_and_userId", ["forumId", "userId"])
  .index("by_classId_and_userId", ["classId", "userId"]);

/** schoolClassMaterialGroups table definition. */
export const SchoolClassMaterialGroups = Table.make(
  "schoolClassMaterialGroups",
  schoolClassMaterialGroupSchema
)
  .index("by_classId_and_parentId_and_order", ["classId", "parentId", "order"])
  .index("by_classId_and_parentId_and_status_and_order", [
    "classId",
    "parentId",
    "status",
    "order",
  ])
  .index("by_status_and_scheduledAt", ["status", "scheduledAt"])
  .searchIndex("search_name", {
    searchField: "name",
    filterFields: ["classId", "parentId", "status"],
  });

/** schoolClassMaterials table definition. */
export const SchoolClassMaterials = Table.make(
  "schoolClassMaterials",
  Schema.Struct({
    groupId: GenericId.GenericId("schoolClassMaterialGroups"),
    classId: GenericId.GenericId("schoolClasses"),
    schoolId: GenericId.GenericId("schools"),
    title: Schema.String,
    body: Schema.optional(Schema.String),
    bodyPlainText: Schema.optional(Schema.String),
    order: Schema.Number,
    status: schoolClassMaterialStatusSchema,
    scheduledAt: Schema.optional(Schema.Number),
    isPinned: Schema.Boolean,
    attachmentCount: Schema.Number,
    viewCount: Schema.Number,
    downloadCount: Schema.Number,
    totalFileSize: Schema.Number,
    createdBy: GenericId.GenericId("users"),
    updatedAt: Schema.Number,
    publishedAt: Schema.optional(Schema.Number),
    publishedBy: Schema.optional(GenericId.GenericId("users")),
  })
)
  .index("by_groupId_and_status_and_isPinned_and_order", [
    "groupId",
    "status",
    "isPinned",
    "order",
  ])
  .index("by_status_and_scheduledAt", ["status", "scheduledAt"])
  .index("by_classId_and_status", ["classId", "status"])
  .searchIndex("search_title", {
    searchField: "title",
    filterFields: ["classId", "groupId", "status"],
  })
  .searchIndex("search_body", {
    searchField: "bodyPlainText",
    filterFields: ["classId", "groupId", "status"],
  });

/** schoolClassMaterialAttachments table definition. */
export const SchoolClassMaterialAttachments = Table.make(
  "schoolClassMaterialAttachments",
  Schema.Struct({
    materialId: GenericId.GenericId("schoolClassMaterials"),
    groupId: GenericId.GenericId("schoolClassMaterialGroups"),
    classId: GenericId.GenericId("schoolClasses"),
    fileId: GenericId.GenericId("_storage"),
    name: Schema.String,
    mimeType: Schema.String,
    size: Schema.Number,
    type: Schema.Literal("inline", "download"),
    order: Schema.Number,
    downloadCount: Schema.Number,
    uploadedBy: GenericId.GenericId("users"),
  })
)
  .index("by_materialId_and_type_and_order", ["materialId", "type", "order"])
  .index("by_classId", ["classId"]);

/** schoolClassMaterialViews table definition. */
export const SchoolClassMaterialViews = Table.make(
  "schoolClassMaterialViews",
  Schema.Struct({
    materialId: GenericId.GenericId("schoolClassMaterials"),
    classId: GenericId.GenericId("schoolClasses"),
    userId: GenericId.GenericId("users"),
    firstViewedAt: Schema.Number,
    lastViewedAt: Schema.Number,
    viewCount: Schema.Number,
    hasDownloaded: Schema.Boolean,
    lastDownloadedAt: Schema.optional(Schema.Number),
  })
)
  .index("by_materialId_and_userId", ["materialId", "userId"])
  .index("by_classId_and_userId", ["classId", "userId"]);

export const tables = [
  SchoolClasses,
  SchoolClassMembers,
  SchoolClassInviteCodes,
  SchoolClassForums,
  SchoolClassForumReactions,
  SchoolClassForumPosts,
  SchoolClassForumPendingUploads,
  SchoolClassForumPostAttachments,
  SchoolClassForumPostReactions,
  SchoolClassForumReadStates,
  SchoolClassMaterialGroups,
  SchoolClassMaterials,
  SchoolClassMaterialAttachments,
  SchoolClassMaterialViews,
] as const;
