import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { deleteQuestion } from "@repo/backend/convex/contentSync/lib/syncHelpers";
import {
  contentSearchResetBatchSize,
  eventTryoutEntitlementBatchSize,
  questionResetBatchSize,
  resetBatchSize,
} from "@repo/backend/convex/contentSync/reset/spec";
import { SUPPORTED_CONTENT_LOCALES } from "@repo/backend/convex/lib/validators/contents";
import { Effect } from "effect";

const TRYOUT_SECTION = "tryout";

/** Deletes one bounded batch of stored try-out entitlements. */
export const deleteTryoutEntitlementRows = Effect.fn(
  "contentSync.reset.deleteTryoutEntitlementRows"
)(function* (ctx: MutationCtx) {
  const entitlements = yield* Effect.promise(() =>
    ctx.db.query("tryoutEntitlements").take(eventTryoutEntitlementBatchSize)
  );

  for (const entitlement of entitlements) {
    yield* Effect.promise(() =>
      ctx.db.delete("tryoutEntitlements", entitlement._id)
    );
  }

  const remaining = yield* Effect.promise(() =>
    ctx.db.query("tryoutEntitlements").first()
  );

  return {
    deleted: entitlements.length,
    hasMore: remaining !== null,
  };
});

/** Deletes one bounded batch of try-out route projections. */
export const deleteTryoutContentRouteRows = Effect.fn(
  "contentSync.reset.deleteTryoutContentRouteRows"
)(function* (ctx: MutationCtx) {
  const docs = yield* Effect.promise(() =>
    ctx.db
      .query("contentRoutes")
      .withIndex("by_section", (query) => query.eq("section", TRYOUT_SECTION))
      .take(resetBatchSize)
  );
  let deleted = 0;

  for (const doc of docs) {
    yield* Effect.promise(() => ctx.db.delete(doc._id));
    deleted += 1;
  }

  const remaining = yield* Effect.promise(() =>
    ctx.db
      .query("contentRoutes")
      .withIndex("by_section", (query) => query.eq("section", TRYOUT_SECTION))
      .first()
  );

  return { deleted, hasMore: remaining !== null };
});

/** Deletes one bounded batch of try-out search projections. */
export const deleteTryoutContentSearchRows = Effect.fn(
  "contentSync.reset.deleteTryoutContentSearchRows"
)(function* (ctx: MutationCtx) {
  let deleted = 0;

  for (const locale of SUPPORTED_CONTENT_LOCALES) {
    if (deleted >= contentSearchResetBatchSize) {
      break;
    }

    const docs = yield* Effect.promise(() =>
      ctx.db
        .query("contentSearch")
        .withIndex("by_locale_and_section_and_title", (query) =>
          query.eq("locale", locale).eq("section", TRYOUT_SECTION)
        )
        .take(contentSearchResetBatchSize - deleted)
    );

    for (const doc of docs) {
      yield* Effect.promise(() => ctx.db.delete(doc._id));
      deleted += 1;
    }
  }

  const hasMore = yield* hasTryoutContentSearchRows(ctx);

  return { deleted, hasMore };
});

/** Deletes one bounded batch of try-out route count rows. */
export const deleteTryoutContentRouteCountRows = Effect.fn(
  "contentSync.reset.deleteTryoutContentRouteCountRows"
)(function* (ctx: MutationCtx) {
  let deleted = 0;

  for (const locale of SUPPORTED_CONTENT_LOCALES) {
    const row = yield* Effect.promise(() =>
      ctx.db
        .query("contentRouteCounts")
        .withIndex("by_locale_and_section", (query) =>
          query.eq("locale", locale).eq("section", TRYOUT_SECTION)
        )
        .unique()
    );

    if (!row) {
      continue;
    }

    yield* Effect.promise(() => ctx.db.delete(row._id));
    deleted += 1;
  }

  const hasMore = yield* hasTryoutContentRouteCountRows(ctx);

  return { deleted, hasMore };
});

/** Deletes one bounded batch of try-out route page rows. */
export const deleteTryoutContentRoutePageRows = Effect.fn(
  "contentSync.reset.deleteTryoutContentRoutePageRows"
)(function* (ctx: MutationCtx) {
  let deleted = 0;

  for (const locale of SUPPORTED_CONTENT_LOCALES) {
    if (deleted >= resetBatchSize) {
      break;
    }

    const docs = yield* Effect.promise(() =>
      ctx.db
        .query("contentRoutePages")
        .withIndex("by_locale_and_section", (query) =>
          query.eq("locale", locale).eq("section", TRYOUT_SECTION)
        )
        .take(resetBatchSize - deleted)
    );

    for (const doc of docs) {
      yield* Effect.promise(() => ctx.db.delete(doc._id));
      deleted += 1;
    }
  }

  const hasMore = yield* hasTryoutContentRoutePageRows(ctx);

  return { deleted, hasMore };
});

/** Deletes one bounded question batch through dependent cleanup. */
export const deleteQuestionRows = Effect.fn(
  "contentSync.reset.deleteQuestionRows"
)(function* (ctx: MutationCtx) {
  const questions = yield* Effect.promise(() =>
    ctx.db.query("questions").take(questionResetBatchSize)
  );
  let deleted = 0;

  for (const question of questions) {
    yield* Effect.promise(() => deleteQuestion(ctx, question._id));
    deleted += 1;
  }

  const remaining = yield* Effect.promise(() =>
    ctx.db.query("questions").first()
  );

  return { deleted, hasMore: remaining !== null };
});

/** Checks whether any locale still has a try-out search projection. */
const hasTryoutContentSearchRows = Effect.fn(
  "contentSync.reset.hasTryoutContentSearchRows"
)(function* (ctx: MutationCtx) {
  for (const locale of SUPPORTED_CONTENT_LOCALES) {
    const row = yield* Effect.promise(() =>
      ctx.db
        .query("contentSearch")
        .withIndex("by_locale_and_section_and_title", (query) =>
          query.eq("locale", locale).eq("section", TRYOUT_SECTION)
        )
        .first()
    );

    if (row) {
      return true;
    }
  }

  return false;
});

/** Checks whether any locale still has a try-out route-count projection. */
const hasTryoutContentRouteCountRows = Effect.fn(
  "contentSync.reset.hasTryoutContentRouteCountRows"
)(function* (ctx: MutationCtx) {
  for (const locale of SUPPORTED_CONTENT_LOCALES) {
    const row = yield* Effect.promise(() =>
      ctx.db
        .query("contentRouteCounts")
        .withIndex("by_locale_and_section", (query) =>
          query.eq("locale", locale).eq("section", TRYOUT_SECTION)
        )
        .first()
    );

    if (row) {
      return true;
    }
  }

  return false;
});

/** Checks whether any locale still has a try-out route-page projection. */
const hasTryoutContentRoutePageRows = Effect.fn(
  "contentSync.reset.hasTryoutContentRoutePageRows"
)(function* (ctx: MutationCtx) {
  for (const locale of SUPPORTED_CONTENT_LOCALES) {
    const row = yield* Effect.promise(() =>
      ctx.db
        .query("contentRoutePages")
        .withIndex("by_locale_and_section", (query) =>
          query.eq("locale", locale).eq("section", TRYOUT_SECTION)
        )
        .first()
    );

    if (row) {
      return true;
    }
  }

  return false;
});
