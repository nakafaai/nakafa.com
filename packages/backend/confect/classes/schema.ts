import { GenericId } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import {
  schoolClassEnrollMethodValidator,
  schoolClassMemberRoleValidator,
  schoolClassTeacherRoleValidator,
} from "@repo/backend/confect/classes/role";
import { Schema } from "effect";
/**
 * School class member role validator
 */

/**
 * School class visibility validator
 */
export const schoolClassVisibilityValidator = Schema.Literals([
  "private",
  "public",
]);
export type SchoolClassVisibility = Schema.Schema.Type<
  typeof schoolClassVisibilityValidator
>;

/**
 * Class material status validator
 */
export const schoolClassMaterialStatusValidator = Schema.Literals([
  "draft",
  "published",
  "scheduled",
  "archived",
]);
export type SchoolClassMaterialStatus = Schema.Schema.Type<
  typeof schoolClassMaterialStatusValidator
>;

/**
 * Class images validator
 */
export const schoolClassImageValidator = Schema.Literals([
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
  "vintage",
]);
export type SchoolClassImage = Schema.Schema.Type<
  typeof schoolClassImageValidator
>;

/**
 * Forum tag validator
 */
export const schoolClassForumTagValidator = Schema.Literals([
  "general",
  "question",
  "announcement",
  "assignment",
  "resource",
]);
export type SchoolClassForumTag = Schema.Schema.Type<
  typeof schoolClassForumTagValidator
>;

/**
 * Forum status validator
 */
export const schoolClassForumStatusValidator = Schema.Literals([
  "open",
  "locked",
  "archived",
]);

/**
 * Reaction count validator
 */
export const schoolClassReactionCountValidator = Schema.Struct({
  emoji: Schema.String,
  count: Schema.Int.check(Schema.isGreaterThan(0)),
});

/**
 * School class base validator (without system fields)
 */
export const schoolClassValidator = Schema.Struct({
  schoolId: IdSchema("schools"),
  name: Schema.String,
  subject: Schema.String,
  year: Schema.String,
  image: schoolClassImageValidator,
  isArchived: Schema.Boolean,
  visibility: schoolClassVisibilityValidator,
  studentCount: Schema.Finite,
  teacherCount: Schema.Finite,
  updatedAt: Schema.Finite,
  createdBy: IdSchema("users"),
  updatedBy: Schema.optionalKey(IdSchema("users")),
  archivedBy: Schema.optionalKey(IdSchema("users")),
  archivedAt: Schema.optionalKey(Schema.Finite),
});

/**
 * School class document validator (with system fields)
 * Used internally for paginatedClassesValidator
 */

/**
 * Paginated classes validator
 */

/**
 * School class member base validator (without system fields)
 */
export const schoolClassMemberValidator = Schema.Struct({
  classId: IdSchema("schoolClasses"),
  userId: IdSchema("users"),
  schoolId: IdSchema("schools"),
  role: schoolClassMemberRoleValidator,
  teacherRole: schoolClassTeacherRoleValidator,
  enrollMethod: schoolClassEnrollMethodValidator,
  inviteCodeId: Schema.optionalKey(IdSchema("schoolClassInviteCodes")),
  updatedAt: Schema.Finite,
  addedBy: Schema.optionalKey(IdSchema("users")),
  removedBy: Schema.optionalKey(IdSchema("users")),
  removedAt: Schema.optionalKey(Schema.Finite),
});

/**
 * School class member document validator (with system fields)
 * Used internally for classMemberWithUserValidator
 */

/**
 * School class invite code base validator (without system fields)
 */
export const schoolClassInviteCodeValidator = Schema.Struct({
  classId: IdSchema("schoolClasses"),
  schoolId: IdSchema("schools"),
  role: schoolClassMemberRoleValidator,
  code: Schema.String,
  enabled: Schema.Boolean,
  expiresAt: Schema.optionalKey(Schema.Finite),
  maxUsage: Schema.optionalKey(Schema.Finite),
  currentUsage: Schema.Finite,
  description: Schema.optionalKey(Schema.String),
  createdBy: IdSchema("users"),
  updatedBy: Schema.optionalKey(IdSchema("users")),
  updatedAt: Schema.Finite,
});

/**
 * Stored forum thread state, including denormalized counters used by the class
 * forum list and conversation sheet.
 */
export const schoolClassForumValidator = Schema.Struct({
  classId: IdSchema("schoolClasses"),
  schoolId: IdSchema("schools"),
  title: Schema.String,
  body: Schema.String,
  tag: schoolClassForumTagValidator,
  status: schoolClassForumStatusValidator,
  isPinned: Schema.Boolean,
  postCount: Schema.Finite,
  nextPostSequence: Schema.Finite,
  reactionCounts: Schema.mutable(
    Schema.Array(schoolClassReactionCountValidator)
  ),
  lastPostAt: Schema.Finite,
  lastPostBy: Schema.optionalKey(IdSchema("users")),
  createdBy: IdSchema("users"),
  updatedAt: Schema.Finite,
});

/**
 * Stored forum post state, including read-boundary reply metadata and
 * denormalized reaction counts.
 */
export const schoolClassForumPostValidator = Schema.Struct({
  forumId: IdSchema("schoolClassForums"),
  classId: IdSchema("schoolClasses"),
  body: Schema.String,
  mentions: Schema.mutable(Schema.Array(IdSchema("users"))),
  parentId: Schema.optionalKey(IdSchema("schoolClassForumPosts")),
  replyToUserId: Schema.optionalKey(IdSchema("users")),
  replyToBody: Schema.optionalKey(Schema.String),
  replyCount: Schema.Finite,
  reactionCounts: Schema.mutable(
    Schema.Array(schoolClassReactionCountValidator)
  ),
  sequence: Schema.Finite,
  createdBy: IdSchema("users"),
  updatedAt: Schema.Finite,
  editedAt: Schema.optionalKey(Schema.Finite),
});

/**
 * School class material group base validator (without system fields)
 */
export const schoolClassMaterialGroupValidator = Schema.Struct({
  classId: IdSchema("schoolClasses"),
  schoolId: IdSchema("schools"),
  name: Schema.String,
  description: Schema.String,
  parentId: Schema.optionalKey(IdSchema("schoolClassMaterialGroups")),
  order: Schema.Finite,
  status: schoolClassMaterialStatusValidator,
  scheduledAt: Schema.optionalKey(Schema.Finite),
  scheduledJobId: Schema.optionalKey(
    GenericId.GenericId("_scheduled_functions")
  ),
  materialCount: Schema.Finite,
  childGroupCount: Schema.Finite,
  createdBy: IdSchema("users"),
  updatedAt: Schema.Finite,
  publishedAt: Schema.optionalKey(Schema.Finite),
  publishedBy: Schema.optionalKey(IdSchema("users")),
});
