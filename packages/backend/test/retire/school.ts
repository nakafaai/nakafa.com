import { TableAggregate } from "@convex-dev/aggregate";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { components, internal } from "@repo/backend/convex/_generated/api";
import type { DataModel, Id } from "@repo/backend/convex/_generated/dataModel";

/** The time every seeded row is written at. */
export const NOW = Date.UTC(2026, 9, 13, 8, 0, 0);

/** The aggregate of posts by forum, with the keys the old post trigger used. */
const bySequence = new TableAggregate<{
  Namespace: Id<"schoolClassForums">;
  Key: number;
  DataModel: DataModel;
  TableName: "schoolClassForumPosts";
}>(components.forumPostsBySequence, {
  namespace: (post) => post.forumId,
  sortKey: (post) => post.sequence,
});

/** The aggregate of posts by forum and author, with the keys the old trigger used. */
const byAuthor = new TableAggregate<{
  Namespace: [Id<"schoolClassForums">, Id<"users">];
  Key: number;
  DataModel: DataModel;
  TableName: "schoolClassForumPosts";
}>(components.forumPostsByAuthorSequence, {
  namespace: (post) => [post.forumId, post.createdBy],
  sortKey: (post) => post.sequence,
});

/** The rows that `seedSchool` writes in each retired table. */
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
    const preparationId = await ctx.db.insert("accountDeletionPreparations", {
      attemptId: "retire-attempt",
      authId: "retire-owner",
      cancellationStartedAt: NOW,
      pendingSchoolId: schoolId,
      pendingSchoolNextCursor: "next-school",
      recoveryGeneration: 0,
      schoolCursor: "school",
      successorCursor: "successor",
      userId: owner,
    });
    await ctx.db.insert("accountDeletionPreparations", {
      authId: "retire-member",
      recoveryGeneration: 0,
      userId: member,
    });
    await ctx.db.insert("accountDeletionSchoolTransfers", {
      preparationId,
      schoolId,
      successorMembershipId: membershipId,
      successorUserId: member,
    });
    return { attached, forumId, member, pending, preparationId, waiting };
  });
  return { ids, t };
}

/** Everything that is left of the first School, read from the deployment. */
export async function leftovers(
  t: Awaited<ReturnType<typeof seedSchool>>["t"],
  ids: Awaited<ReturnType<typeof seedSchool>>["ids"]
) {
  return await t.run(async (ctx) => ({
    attached: await ctx.db.system.get(ids.attached),
    byAuthor: await byAuthor.count(ctx, {
      namespace: [ids.forumId, ids.member],
    }),
    bySequence: await bySequence.count(ctx, { namespace: ids.forumId }),
    job: (await ctx.db.system.get(ids.waiting))?.state.kind,
    pending: await ctx.db.system.get(ids.pending),
    preparation: await ctx.db.get(ids.preparationId),
    tables: {
      accountDeletionSchoolTransfers: (
        await ctx.db.query("accountDeletionSchoolTransfers").collect()
      ).length,
      schoolActivityLogs: (await ctx.db.query("schoolActivityLogs").collect())
        .length,
      schoolClassForumPendingUploads: (
        await ctx.db.query("schoolClassForumPendingUploads").collect()
      ).length,
      schoolClassForumPostAttachments: (
        await ctx.db.query("schoolClassForumPostAttachments").collect()
      ).length,
      schoolClassForumPostReactions: (
        await ctx.db.query("schoolClassForumPostReactions").collect()
      ).length,
      schoolClassForumPosts: (
        await ctx.db.query("schoolClassForumPosts").collect()
      ).length,
      schoolClassForumReactions: (
        await ctx.db.query("schoolClassForumReactions").collect()
      ).length,
      schoolClassForumReadStates: (
        await ctx.db.query("schoolClassForumReadStates").collect()
      ).length,
      schoolClassForums: (await ctx.db.query("schoolClassForums").collect())
        .length,
      schoolClassInviteCodes: (
        await ctx.db.query("schoolClassInviteCodes").collect()
      ).length,
      schoolClassMaterialGroups: (
        await ctx.db.query("schoolClassMaterialGroups").collect()
      ).length,
      schoolClassMembers: (await ctx.db.query("schoolClassMembers").collect())
        .length,
      schoolClasses: (await ctx.db.query("schoolClasses").collect()).length,
      schoolInviteCodes: (await ctx.db.query("schoolInviteCodes").collect())
        .length,
      schoolMembers: (await ctx.db.query("schoolMembers").collect()).length,
      schools: (await ctx.db.query("schools").collect()).length,
    },
  }));
}
