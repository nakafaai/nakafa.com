import type { Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
  StorageWriter,
} from "@repo/backend/confect/_generated/services";
import { Duration, Effect } from "effect";

const SCHOOL_CLASS_MEMBER_CLEANUP_BATCH_SIZE = 100;
const SCHOOL_CLASS_INVITE_CODE_CLEANUP_BATCH_SIZE = 100;
const SCHOOL_CLASS_FORUM_CLEANUP_BATCH_SIZE = 25;
const SCHOOL_CLASS_MATERIAL_GROUP_CLEANUP_BATCH_SIZE = 25;
const ENTITY_NOTIFICATION_CLEANUP_BATCH_SIZE = 100;
const ENTITY_MUTE_CLEANUP_BATCH_SIZE = 100;
const FORUM_REACTION_CLEANUP_BATCH_SIZE = 100;
const FORUM_PENDING_UPLOAD_CLEANUP_BATCH_SIZE = 25;
const FORUM_READ_STATE_CLEANUP_BATCH_SIZE = 100;
const FORUM_POST_CLEANUP_BATCH_SIZE = 50;
const FORUM_POST_ATTACHMENT_CLEANUP_BATCH_SIZE = 25;
const FORUM_POST_REACTION_CLEANUP_BATCH_SIZE = 100;

type SchoolCleanupEntity =
  | "schoolClasses"
  | "schoolClassForums"
  | "schoolClassForumPosts";

const CLEANUP_DELAY = Duration.millis(0);

/** Deletes notification rows for one deleted entity batch. */
const deleteEntityNotifications = Effect.fn(
  "schoolCleanup.deleteEntityNotifications"
)(function* (
  entityType: SchoolCleanupEntity,
  entityId:
    | Id<"schoolClasses">
    | Id<"schoolClassForums">
    | Id<"schoolClassForumPosts">
) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const notifications = yield* reader
    .table("notifications")
    .index("by_entityType_and_entityId", (query) =>
      query.eq("entityType", entityType).eq("entityId", entityId)
    )
    .take(ENTITY_NOTIFICATION_CLEANUP_BATCH_SIZE);

  for (const notification of notifications) {
    yield* writer.table("notifications").delete(notification._id);
  }

  return notifications.length;
});

/** Deletes notification mute rows for one deleted entity batch. */
const deleteEntityMutes = Effect.fn("schoolCleanup.deleteEntityMutes")(
  function* (
    entityType: SchoolCleanupEntity,
    entityId:
      | Id<"schoolClasses">
      | Id<"schoolClassForums">
      | Id<"schoolClassForumPosts">
  ) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const mutes = yield* reader
      .table("notificationEntityMutes")
      .index("by_entityType_and_entityId", (query) =>
        query.eq("entityType", entityType).eq("entityId", entityId)
      )
      .take(ENTITY_MUTE_CLEANUP_BATCH_SIZE);

    for (const mute of mutes) {
      yield* writer.table("notificationEntityMutes").delete(mute._id);
    }

    return mutes.length;
  }
);

/** Removes dependent rows after a class row has been deleted. */
export const cleanupDeletedClass = Effect.fn(
  "schoolCleanup.cleanupDeletedClass"
)(function* (args: { classId: Id<"schoolClasses"> }) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const scheduler = yield* Scheduler;
  const classMembers = yield* reader
    .table("schoolClassMembers")
    .index("by_classId_and_userId", (query) =>
      query.eq("classId", args.classId)
    )
    .take(SCHOOL_CLASS_MEMBER_CLEANUP_BATCH_SIZE);

  for (const member of classMembers) {
    yield* writer.table("schoolClassMembers").delete(member._id);
  }

  if (classMembers.length === SCHOOL_CLASS_MEMBER_CLEANUP_BATCH_SIZE) {
    yield* scheduler.runAfter(
      CLEANUP_DELAY,
      refs.internal.triggers.schools.cleanup.cleanupDeletedClass,
      args
    );
    return null;
  }

  const inviteCodes = yield* reader
    .table("schoolClassInviteCodes")
    .index("by_classId_and_role", (query) => query.eq("classId", args.classId))
    .take(SCHOOL_CLASS_INVITE_CODE_CLEANUP_BATCH_SIZE);

  for (const inviteCode of inviteCodes) {
    yield* writer.table("schoolClassInviteCodes").delete(inviteCode._id);
  }

  if (
    inviteCodes.length === SCHOOL_CLASS_INVITE_CODE_CLEANUP_BATCH_SIZE ||
    (yield* deleteEntityNotifications("schoolClasses", args.classId)) ===
      ENTITY_NOTIFICATION_CLEANUP_BATCH_SIZE ||
    (yield* deleteEntityMutes("schoolClasses", args.classId)) ===
      ENTITY_MUTE_CLEANUP_BATCH_SIZE
  ) {
    yield* scheduler.runAfter(
      CLEANUP_DELAY,
      refs.internal.triggers.schools.cleanup.cleanupDeletedClass,
      args
    );
    return null;
  }

  const forums = yield* reader
    .table("schoolClassForums")
    .index("by_classId_and_lastPostAt", (query) =>
      query.eq("classId", args.classId)
    )
    .take(SCHOOL_CLASS_FORUM_CLEANUP_BATCH_SIZE);

  for (const forum of forums) {
    yield* scheduler.runAfter(
      CLEANUP_DELAY,
      refs.internal.triggers.schools.cleanup.cleanupDeletedForum,
      { forumId: forum._id }
    );
    yield* writer.table("schoolClassForums").delete(forum._id);
  }

  if (forums.length === SCHOOL_CLASS_FORUM_CLEANUP_BATCH_SIZE) {
    yield* scheduler.runAfter(
      CLEANUP_DELAY,
      refs.internal.triggers.schools.cleanup.cleanupDeletedClass,
      args
    );
    return null;
  }

  const materialGroups = yield* reader
    .table("schoolClassMaterialGroups")
    .index("by_classId_and_parentId_and_order", (query) =>
      query.eq("classId", args.classId)
    )
    .take(SCHOOL_CLASS_MATERIAL_GROUP_CLEANUP_BATCH_SIZE);

  for (const group of materialGroups) {
    yield* writer.table("schoolClassMaterialGroups").delete(group._id);
  }

  if (
    materialGroups.length === SCHOOL_CLASS_MATERIAL_GROUP_CLEANUP_BATCH_SIZE
  ) {
    yield* scheduler.runAfter(
      CLEANUP_DELAY,
      refs.internal.triggers.schools.cleanup.cleanupDeletedClass,
      args
    );
  }

  return null;
});

/** Removes dependent rows after a forum row has been deleted. */
export const cleanupDeletedForum = Effect.fn(
  "schoolCleanup.cleanupDeletedForum"
)(function* (args: { forumId: Id<"schoolClassForums"> }) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const scheduler = yield* Scheduler;
  const storage = yield* StorageWriter;

  if (
    (yield* deleteEntityNotifications("schoolClassForums", args.forumId)) ===
      ENTITY_NOTIFICATION_CLEANUP_BATCH_SIZE ||
    (yield* deleteEntityMutes("schoolClassForums", args.forumId)) ===
      ENTITY_MUTE_CLEANUP_BATCH_SIZE
  ) {
    yield* scheduler.runAfter(
      CLEANUP_DELAY,
      refs.internal.triggers.schools.cleanup.cleanupDeletedForum,
      args
    );
    return null;
  }

  const forumReactions = yield* reader
    .table("schoolClassForumReactions")
    .index("by_forumId_and_emoji_and_userId", (query) =>
      query.eq("forumId", args.forumId)
    )
    .take(FORUM_REACTION_CLEANUP_BATCH_SIZE);

  for (const reaction of forumReactions) {
    yield* writer.table("schoolClassForumReactions").delete(reaction._id);
  }

  if (forumReactions.length === FORUM_REACTION_CLEANUP_BATCH_SIZE) {
    yield* scheduler.runAfter(
      CLEANUP_DELAY,
      refs.internal.triggers.schools.cleanup.cleanupDeletedForum,
      args
    );
    return null;
  }

  const pendingUploads = yield* reader
    .table("schoolClassForumPendingUploads")
    .index("by_forumId_and_uploadedBy", (query) =>
      query.eq("forumId", args.forumId)
    )
    .take(FORUM_PENDING_UPLOAD_CLEANUP_BATCH_SIZE);

  for (const upload of pendingUploads) {
    if (upload.storageId) {
      const storageId = upload.storageId;
      yield* storage
        .delete(storageId)
        .pipe(Effect.catchTag("BlobNotFoundError", () => Effect.succeed(null)));
    }
    yield* writer.table("schoolClassForumPendingUploads").delete(upload._id);
  }

  if (pendingUploads.length === FORUM_PENDING_UPLOAD_CLEANUP_BATCH_SIZE) {
    yield* scheduler.runAfter(
      CLEANUP_DELAY,
      refs.internal.triggers.schools.cleanup.cleanupDeletedForum,
      args
    );
    return null;
  }

  const readStates = yield* reader
    .table("schoolClassForumReadStates")
    .index("by_forumId_and_userId", (query) =>
      query.eq("forumId", args.forumId)
    )
    .take(FORUM_READ_STATE_CLEANUP_BATCH_SIZE);

  for (const readState of readStates) {
    yield* writer.table("schoolClassForumReadStates").delete(readState._id);
  }

  if (readStates.length === FORUM_READ_STATE_CLEANUP_BATCH_SIZE) {
    yield* scheduler.runAfter(
      CLEANUP_DELAY,
      refs.internal.triggers.schools.cleanup.cleanupDeletedForum,
      args
    );
    return null;
  }

  const posts = yield* reader
    .table("schoolClassForumPosts")
    .index("by_forumId", (query) => query.eq("forumId", args.forumId))
    .take(FORUM_POST_CLEANUP_BATCH_SIZE);

  for (const post of posts) {
    yield* scheduler.runAfter(
      CLEANUP_DELAY,
      refs.internal.triggers.schools.cleanup.cleanupDeletedForumPost,
      { postId: post._id }
    );
    yield* writer.table("schoolClassForumPosts").delete(post._id);
  }

  if (posts.length === FORUM_POST_CLEANUP_BATCH_SIZE) {
    yield* scheduler.runAfter(
      CLEANUP_DELAY,
      refs.internal.triggers.schools.cleanup.cleanupDeletedForum,
      args
    );
  }

  return null;
});

/** Removes dependent rows after a forum post row has been deleted. */
export const cleanupDeletedForumPost = Effect.fn(
  "schoolCleanup.cleanupDeletedForumPost"
)(function* (args: { postId: Id<"schoolClassForumPosts"> }) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const scheduler = yield* Scheduler;
  const storage = yield* StorageWriter;

  if (
    (yield* deleteEntityNotifications("schoolClassForumPosts", args.postId)) ===
      ENTITY_NOTIFICATION_CLEANUP_BATCH_SIZE ||
    (yield* deleteEntityMutes("schoolClassForumPosts", args.postId)) ===
      ENTITY_MUTE_CLEANUP_BATCH_SIZE
  ) {
    yield* scheduler.runAfter(
      CLEANUP_DELAY,
      refs.internal.triggers.schools.cleanup.cleanupDeletedForumPost,
      args
    );
    return null;
  }

  const attachments = yield* reader
    .table("schoolClassForumPostAttachments")
    .index("by_postId", (query) => query.eq("postId", args.postId))
    .take(FORUM_POST_ATTACHMENT_CLEANUP_BATCH_SIZE);

  for (const attachment of attachments) {
    yield* storage
      .delete(attachment.fileId)
      .pipe(Effect.catchTag("BlobNotFoundError", () => Effect.succeed(null)));
    yield* writer
      .table("schoolClassForumPostAttachments")
      .delete(attachment._id);
  }

  if (attachments.length === FORUM_POST_ATTACHMENT_CLEANUP_BATCH_SIZE) {
    yield* scheduler.runAfter(
      CLEANUP_DELAY,
      refs.internal.triggers.schools.cleanup.cleanupDeletedForumPost,
      args
    );
    return null;
  }

  const reactions = yield* reader
    .table("schoolClassForumPostReactions")
    .index("by_postId_and_emoji_and_userId", (query) =>
      query.eq("postId", args.postId)
    )
    .take(FORUM_POST_REACTION_CLEANUP_BATCH_SIZE);

  for (const reaction of reactions) {
    yield* writer.table("schoolClassForumPostReactions").delete(reaction._id);
  }

  if (reactions.length === FORUM_POST_REACTION_CLEANUP_BATCH_SIZE) {
    yield* scheduler.runAfter(
      CLEANUP_DELAY,
      refs.internal.triggers.schools.cleanup.cleanupDeletedForumPost,
      args
    );
  }

  return null;
});
