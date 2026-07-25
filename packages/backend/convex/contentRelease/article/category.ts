import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { loadArticleOwner } from "@repo/backend/convex/contentRelease/article/owner";
import {
  decodeCategory,
  verifyCategory,
} from "@repo/backend/convex/contentRelease/article/verify";
import { Effect } from "effect";

/** Resolves one exact category through the active article read model. */
export const readArticleCategory = Effect.fn(
  "contentRelease.readArticleCategory"
)(function* (
  ctx: QueryCtx,
  locale: Doc<"articleCategories">["locale"],
  source: string
) {
  const [category, owner] = yield* Effect.all([
    decodeCategory(source),
    loadArticleOwner(ctx, locale),
  ]);
  if (!(owner.managed && owner.active)) {
    return { exists: false, managed: false };
  }

  const row = yield* Effect.promise(() =>
    ctx.db
      .query("articleCategories")
      .withIndex("by_locale_and_category", (index) =>
        index.eq("locale", locale).eq("category", category)
      )
      .unique()
  );
  if (!row) {
    return { exists: false, managed: true };
  }

  yield* verifyCategory(ctx, row, owner.active.sequence);
  return { exists: true, managed: true };
});
