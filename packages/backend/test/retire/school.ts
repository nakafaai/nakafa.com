import { TableAggregate } from "@convex-dev/aggregate";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { components, internal } from "@repo/backend/convex/_generated/api";
import type { DataModel, Id } from "@repo/backend/convex/_generated/dataModel";
import { seedAccounts } from "@repo/backend/test/retire/account";

/** The time every seeded row is written at. */
export const NOW = Date.UTC(2026, 9, 13, 8, 0, 0);

/** The aggregate of posts by forum, with the keys the old post trigger used. */
export const bySequence = new TableAggregate<{
  Namespace: Id<"schoolClassForums">;
  Key: number;
  DataModel: DataModel;
  TableName: "schoolClassForumPosts";
}>(components.forumPostsBySequence, {
  namespace: (post) => post.forumId,
  sortKey: (post) => post.sequence,
});

/** The aggregate of posts by forum and author, with the keys the old trigger used. */
export const byAuthor = new TableAggregate<{
  Namespace: [Id<"schoolClassForums">, Id<"users">];
  Key: number;
  DataModel: DataModel;
  TableName: "schoolClassForumPosts";
}>(components.forumPostsByAuthorSequence, {
  namespace: (post) => [post.forumId, post.createdBy],
  sortKey: (post) => post.sequence,
});

/**
 * What the migration counts for the rows that `seedSchool` writes: every row of
 * a retired table, and the rows of a table that stays which hold a retired
 * field.
 */
export const SEEDED = {
  accountDeletionPreparations: 1,
  accountDeletionSchoolTransfers: 1,
  schoolActivityLogs: 1,
  schoolClassForumPendingUploads: 2,
  schoolClassForumPostAttachments: 2,
  schoolClassForumPostReactions: 1,
  schoolClassForumPosts: 1,
  schoolClassForumReactions: 1,
  schoolClassForumReadStates: 1,
  schoolClassForums: 1,
  schoolClassInviteCodes: 1,
  schoolClassMaterialGroups: 3,
  schoolClassMembers: 1,
  schoolClasses: 1,
  schoolInviteCodes: 1,
  schoolMembers: 1,
  schools: 1,
  subscriptions: 1,
};

/**
 * Seeds every table of the first School with the leftovers that go with it: a
 * stored file on an attachment and on an upload, one attachment whose file is
 * gone, a class material that waits on a scheduled job, one whose job was
 * canceled, and a forum post in both aggregates.
 */
export async function seedSchool() {
  vi.useFakeTimers();
  const t = createConvexTestWithBetterAuth();
  const ids = await t.run(async (ctx) => {
    const owner = await ctx.db.insert("users", {
      authId: "retire-owner",
      credits: 0,
      creditsResetAt: 0,
      email: "owner@example.com",
      name: "Owner",
      plan: "free",
    });
    const member = await ctx.db.insert("users", {
      authId: "retire-member",
      credits: 0,
      creditsResetAt: 0,
      email: "member@example.com",
      name: "Member",
      plan: "free",
    });
    const schoolId = await ctx.db.insert("schools", {
      city: "Jakarta",
      createdBy: owner,
      currentStudents: 1,
      currentTeachers: 1,
      email: "school@example.com",
      name: "Retired School",
      province: "DKI Jakarta",
      slug: "retired-school",
      type: "high-school",
      updatedAt: NOW,
    });
    const membershipId = await ctx.db.insert("schoolMembers", {
      joinedAt: NOW,
      role: "student",
      schoolId,
      status: "active",
      updatedAt: NOW,
      userId: member,
    });
    await ctx.db.insert("schoolInviteCodes", {
      code: "SCHOOL1",
      createdBy: owner,
      currentUsage: 0,
      enabled: true,
      role: "student",
      schoolId,
      updatedAt: NOW,
    });
    await ctx.db.insert("schoolActivityLogs", {
      action: "school_created",
      entityId: schoolId,
      entityType: "schools",
      metadata: { schoolName: "Retired School" },
      schoolId,
      userId: owner,
    });
    const classId = await ctx.db.insert("schoolClasses", {
      createdBy: owner,
      image: "logic",
      isArchived: false,
      name: "Retired Class",
      schoolId,
      studentCount: 1,
      subject: "Mathematics",
      teacherCount: 1,
      updatedAt: NOW,
      visibility: "private",
      year: "2026",
    });
    await ctx.db.insert("schoolClassMembers", {
      classId,
      role: "student",
      schoolId,
      updatedAt: NOW,
      userId: member,
    });
    await ctx.db.insert("schoolClassInviteCodes", {
      classId,
      code: "CLASS1",
      createdBy: owner,
      currentUsage: 0,
      enabled: true,
      role: "student",
      schoolId,
      updatedAt: NOW,
    });
    const material = {
      childGroupCount: 0,
      classId,
      createdBy: owner,
      description: "A material group",
      materialCount: 0,
      order: 0,
      schoolId,
      updatedAt: NOW,
    };
    const waiting = await ctx.scheduler.runAfter(
      60_000,
      internal.auth.deletion.sweepAccountDeletionRetention,
      {}
    );
    const canceled = await ctx.scheduler.runAfter(
      60_000,
      internal.auth.deletion.sweepAccountDeletionRetention,
      {}
    );
    await ctx.scheduler.cancel(canceled);
    await ctx.db.insert("schoolClassMaterialGroups", {
      ...material,
      name: "Scheduled",
      scheduledAt: NOW + 60_000,
      scheduledJobId: waiting,
      status: "scheduled",
    });
    await ctx.db.insert("schoolClassMaterialGroups", {
      ...material,
      name: "Canceled",
      scheduledJobId: canceled,
      status: "draft",
    });
    await ctx.db.insert("schoolClassMaterialGroups", {
      ...material,
      name: "Draft",
      status: "draft",
    });
    const forumId = await ctx.db.insert("schoolClassForums", {
      body: "The first thread",
      classId,
      createdBy: owner,
      isPinned: false,
      lastPostAt: NOW,
      nextPostSequence: 2,
      postCount: 1,
      reactionCounts: [],
      schoolId,
      status: "open",
      tag: "general",
      title: "Thread",
      updatedAt: NOW,
    });
    const postId = await ctx.db.insert("schoolClassForumPosts", {
      body: "The first post",
      classId,
      createdBy: member,
      forumId,
      mentions: [],
      reactionCounts: [],
      replyCount: 0,
      sequence: 1,
      updatedAt: NOW,
    });
    const post = await ctx.db.get(postId);
    if (post) {
      await bySequence.insert(ctx, post);
      await byAuthor.insert(ctx, post);
    }
    const attached = await ctx.storage.store(new Blob(["attached"]));
    const pending = await ctx.storage.store(new Blob(["pending"]));
    const gone = await ctx.storage.store(new Blob(["gone"]));
    await ctx.storage.delete(gone);
    for (const fileId of [attached, gone]) {
      await ctx.db.insert("schoolClassForumPostAttachments", {
        classId,
        createdBy: member,
        fileId,
        forumId,
        mimeType: "application/pdf",
        name: "file.pdf",
        postId,
        size: 8,
      });
    }
    await ctx.db.insert("schoolClassForumPostReactions", {
      emoji: "👍",
      postId,
      userId: owner,
    });
    await ctx.db.insert("schoolClassForumReactions", {
      emoji: "👍",
      forumId,
      userId: owner,
    });
    await ctx.db.insert("schoolClassForumReadStates", {
      classId,
      forumId,
      lastReadSequence: 1,
      userId: member,
    });
    for (const storageId of [pending, undefined]) {
      await ctx.db.insert("schoolClassForumPendingUploads", {
        classId,
        expiresAt: NOW + 1000,
        forumId,
        ...(storageId === undefined ? {} : { storageId }),
        uploadToken: "token",
        uploadedBy: member,
      });
    }
    const accounts = await seedAccounts(ctx, {
      member,
      membershipId,
      now: NOW,
      owner,
      schoolId,
    });
    return { ...accounts, attached, forumId, member, pending, waiting };
  });
  return { ids, t };
}
