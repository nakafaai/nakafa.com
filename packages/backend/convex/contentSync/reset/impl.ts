import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { deleteQuestion } from "@repo/backend/convex/contentSync/lib/syncHelpers";
import {
  batchDeleteResultValidator,
  contentSearchResetBatchSize,
  eventTryoutEntitlementBatchSize,
  questionResetBatchSize,
  type ResettableTableName,
  resetBatchSize,
} from "@repo/backend/convex/contentSync/reset/spec";
import { internalMutation } from "@repo/backend/convex/functions";
import { SUPPORTED_CONTENT_LOCALES } from "@repo/backend/convex/lib/validators/contents";

const TRYOUT_SECTION = "tryout";

/** Deletes one bounded batch from a resettable content-derived table. */
export async function deleteBatchFromTable(
  ctx: MutationCtx,
  tableName: ResettableTableName
) {
  const docs = await ctx.db.query(tableName).take(resetBatchSize);
  let deleted = 0;

  for (const doc of docs) {
    await ctx.db.delete(tableName, doc._id);
    deleted++;
  }

  const hasMore = (await ctx.db.query(tableName).first()) !== null;

  return { deleted, hasMore };
}

/**
 * Deletes one small batch of full-text search rows.
 *
 * Search documents can contain large MDX text payloads, so the generic reset
 * batch can exceed Convex's per-function read byte limit before the reset loop
 * gets a chance to continue.
 */
export async function deleteContentSearchRows(ctx: MutationCtx) {
  const docs = await ctx.db
    .query("contentSearch")
    .take(contentSearchResetBatchSize);
  let deleted = 0;

  for (const doc of docs) {
    await ctx.db.delete(doc._id);
    deleted++;
  }

  const hasMore = (await ctx.db.query("contentSearch").first()) !== null;

  return { deleted, hasMore };
}

/** Deletes one bounded batch of section attempts owned by tryout attempts. */
export async function deleteTryoutRuntimeRows(ctx: MutationCtx) {
  const sectionAttempts = await ctx.db
    .query("tryoutSectionAttempts")
    .take(resetBatchSize);
  let deleted = 0;

  for (const sectionAttempt of sectionAttempts) {
    await ctx.db.delete("tryoutSectionAttempts", sectionAttempt._id);
    deleted += 1;
  }

  const hasMore =
    (await ctx.db.query("tryoutSectionAttempts").first()) !== null;

  return { deleted, hasMore };
}

/**
 * Deletes generated audio rows with their Convex storage blobs.
 *
 * @see https://docs.convex.dev/file-storage/delete-files
 */
export async function deleteContentAudioRows(ctx: MutationCtx) {
  const audios = await ctx.db.query("contentAudios").take(resetBatchSize);
  let deleted = 0;

  for (const audio of audios) {
    if (audio.audioStorageId) {
      const metadata = await ctx.db.system.get(
        "_storage",
        audio.audioStorageId
      );

      if (metadata) {
        await ctx.storage.delete(audio.audioStorageId);
      }
    }

    await ctx.db.delete("contentAudios", audio._id);
    deleted += 1;
  }

  const hasMore = (await ctx.db.query("contentAudios").first()) !== null;

  return { deleted, hasMore };
}

/** Deletes one bounded batch of stored tryout entitlements. */
export async function deleteTryoutEntitlementRows(ctx: MutationCtx) {
  const entitlements = await ctx.db
    .query("tryoutEntitlements")
    .take(eventTryoutEntitlementBatchSize);

  for (const entitlement of entitlements) {
    await ctx.db.delete("tryoutEntitlements", entitlement._id);
  }

  const hasMore = (await ctx.db.query("tryoutEntitlements").first()) !== null;

  return {
    deleted: entitlements.length,
    hasMore,
  };
}

/** Deletes one bounded batch of try-out route projections. */
export async function deleteTryoutContentRouteRows(ctx: MutationCtx) {
  const docs = await ctx.db
    .query("contentRoutes")
    .withIndex("by_section", (q) => q.eq("section", TRYOUT_SECTION))
    .take(resetBatchSize);
  let deleted = 0;

  for (const doc of docs) {
    await ctx.db.delete(doc._id);
    deleted += 1;
  }

  const hasMore =
    (await ctx.db
      .query("contentRoutes")
      .withIndex("by_section", (q) => q.eq("section", TRYOUT_SECTION))
      .first()) !== null;

  return { deleted, hasMore };
}

/** Deletes one bounded batch of try-out search projections. */
export async function deleteTryoutContentSearchRows(ctx: MutationCtx) {
  let deleted = 0;

  for (const locale of SUPPORTED_CONTENT_LOCALES) {
    if (deleted >= contentSearchResetBatchSize) {
      break;
    }

    const docs = await ctx.db
      .query("contentSearch")
      .withIndex("by_locale_and_section_and_title", (q) =>
        q.eq("locale", locale).eq("section", TRYOUT_SECTION)
      )
      .take(contentSearchResetBatchSize - deleted);

    for (const doc of docs) {
      await ctx.db.delete(doc._id);
      deleted += 1;
    }
  }

  return {
    deleted,
    hasMore: await hasTryoutContentSearchRows(ctx),
  };
}

/** Deletes one bounded batch of try-out route count rows. */
export async function deleteTryoutContentRouteCountRows(ctx: MutationCtx) {
  let deleted = 0;

  for (const locale of SUPPORTED_CONTENT_LOCALES) {
    const row = await ctx.db
      .query("contentRouteCounts")
      .withIndex("by_locale_and_section", (q) =>
        q.eq("locale", locale).eq("section", TRYOUT_SECTION)
      )
      .unique();

    if (!row) {
      continue;
    }

    await ctx.db.delete(row._id);
    deleted += 1;
  }

  return {
    deleted,
    hasMore: await hasTryoutContentRouteCountRows(ctx),
  };
}

/** Deletes one bounded batch of try-out route page rows. */
export async function deleteTryoutContentRoutePageRows(ctx: MutationCtx) {
  let deleted = 0;

  for (const locale of SUPPORTED_CONTENT_LOCALES) {
    if (deleted >= resetBatchSize) {
      break;
    }

    const docs = await ctx.db
      .query("contentRoutePages")
      .withIndex("by_locale_and_section", (q) =>
        q.eq("locale", locale).eq("section", TRYOUT_SECTION)
      )
      .take(resetBatchSize - deleted);

    for (const doc of docs) {
      await ctx.db.delete(doc._id);
      deleted += 1;
    }
  }

  return {
    deleted,
    hasMore: await hasTryoutContentRoutePageRows(ctx),
  };
}

/** Deletes questions through their dependent cleanup helper. */
export async function deleteQuestionRows(ctx: MutationCtx) {
  const questions = await ctx.db
    .query("questions")
    .take(questionResetBatchSize);
  let deleted = 0;

  for (const question of questions) {
    await deleteQuestion(ctx, question._id);
    deleted += 1;
  }

  const hasMore = (await ctx.db.query("questions").first()) !== null;

  return { deleted, hasMore };
}

/** Check whether any locale still has a try-out search projection. */
async function hasTryoutContentSearchRows(ctx: MutationCtx) {
  for (const locale of SUPPORTED_CONTENT_LOCALES) {
    const row = await ctx.db
      .query("contentSearch")
      .withIndex("by_locale_and_section_and_title", (q) =>
        q.eq("locale", locale).eq("section", TRYOUT_SECTION)
      )
      .first();

    if (row) {
      return true;
    }
  }

  return false;
}

/** Check whether any locale still has a try-out route-count projection. */
async function hasTryoutContentRouteCountRows(ctx: MutationCtx) {
  for (const locale of SUPPORTED_CONTENT_LOCALES) {
    const row = await ctx.db
      .query("contentRouteCounts")
      .withIndex("by_locale_and_section", (q) =>
        q.eq("locale", locale).eq("section", TRYOUT_SECTION)
      )
      .first();

    if (row) {
      return true;
    }
  }

  return false;
}

/** Check whether any locale still has a try-out route-page projection. */
async function hasTryoutContentRoutePageRows(ctx: MutationCtx) {
  for (const locale of SUPPORTED_CONTENT_LOCALES) {
    const row = await ctx.db
      .query("contentRoutePages")
      .withIndex("by_locale_and_section", (q) =>
        q.eq("locale", locale).eq("section", TRYOUT_SECTION)
      )
      .first();

    if (row) {
      return true;
    }
  }

  return false;
}

/** Creates one small internal mutation that deletes a single bounded batch. */
export function createBatchDeleteMutation(tableName: ResettableTableName) {
  return internalMutation({
    args: {},
    returns: batchDeleteResultValidator,
    handler: async (ctx) => deleteBatchFromTable(ctx, tableName),
  });
}
