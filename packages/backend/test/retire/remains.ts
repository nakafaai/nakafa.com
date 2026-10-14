import {
  byAuthor,
  bySequence,
  type seedSchool,
} from "@repo/backend/test/retire/school";

/**
 * Everything that is left of the first School, read from the deployment: the
 * files, the scheduled job, and the aggregate entries a row owned, the row
 * count of each retired table, and the rows of the two tables that stay.
 */
export async function remains(
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
    subscriptions: {
      linked: await ctx.db.get(ids.linked),
      plain: await ctx.db.get(ids.plain),
    },
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
