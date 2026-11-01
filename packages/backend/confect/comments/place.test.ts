import { Ref } from "@confect/core";
import { mutationLayer } from "@confect/server/RegisteredConvexFunction";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import confectSchema from "@repo/backend/confect/_generated/schema";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import { activateMaterialCatalog } from "@repo/backend/test/material/catalog";
import { Array as Arr, Effect } from "effect";

const now = Date.UTC(2026, 8, 1);
const KEY = makeMaterialProjection("en", 1).contentKey;
const place = Ref.getFunctionReference(
  refs.public.comments.queries.getCommentPlace
);

/** The activation of one lesson in the given languages, for one mutation. */
const activate = (appLocales: readonly ("en" | "id")[], ctx: MutationCtx) =>
  activateMaterialCatalog(
    Arr.map(appLocales, (appLocale) => makeMaterialProjection(appLocale, 1))
  ).pipe(Effect.provide(mutationLayer(confectSchema, ctx)));

/** A deployment with one account, whose comment stands on `slug`, and a lesson in `appLocales`. */
async function commentOn(
  slug: string,
  appLocales: readonly ("en" | "id")[] = []
) {
  const t = createConvexTestWithBetterAuth();
  if (Arr.isReadonlyArrayNonEmpty(appLocales)) {
    await t.mutation((ctx) => Effect.runPromise(activate(appLocales, ctx)));
  }
  const commentId = await t.mutation(async (ctx) => {
    const { userId } = await seedAuthenticatedUser(ctx, {
      now,
      suffix: "place",
    });
    return ctx.db.insert("comments", {
      likeCount: 0,
      replyCount: 0,
      slug,
      text: "A comment",
      userId,
    });
  });
  return { commentId, t };
}

describe("comments/place", () => {
  it("opens an article's comment at the path its slug holds, in the reader's language", async () => {
    const { commentId, t } = await commentOn("articles/politics/example");

    expect(await t.query(place, { appLocale: "id", commentId })).toStrictEqual({
      appLocale: "id",
      publicPath: "articles/politics/example",
    });
  });

  it("finds a lesson's path in the reader's language from its content key", async () => {
    const { commentId, t } = await commentOn(KEY, ["en", "id"]);
    const projection = makeMaterialProjection("id", 1);

    expect(await t.query(place, { appLocale: "id", commentId })).toStrictEqual({
      appLocale: "id",
      publicPath: projection.publicPath,
    });
  });

  it("opens a lesson in another language when the reader's has none", async () => {
    const { commentId, t } = await commentOn(KEY, ["en"]);
    const projection = makeMaterialProjection("en", 1);

    expect(await t.query(place, { appLocale: "id", commentId })).toStrictEqual({
      appLocale: "en",
      publicPath: projection.publicPath,
    });
  });

  it("finds no page for a lesson that left the release, or before any release", async () => {
    const gone = await commentOn(`${KEY}-gone`, ["en", "id"]);
    expect(
      await gone.t.query(place, {
        appLocale: "id",
        commentId: gone.commentId,
      })
    ).toBeNull();

    const unreleased = await commentOn(KEY);
    expect(
      await unreleased.t.query(place, {
        appLocale: "id",
        commentId: unreleased.commentId,
      })
    ).toBeNull();
  });

  it("finds no page for a deleted comment", async () => {
    const { commentId, t } = await commentOn("articles/politics/example");
    await t.run((ctx) => ctx.db.delete(commentId));

    expect(await t.query(place, { appLocale: "id", commentId })).toBeNull();
  });
});
