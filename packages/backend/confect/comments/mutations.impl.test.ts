import { Ref } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import { Array as Arr, Option } from "effect";

const now = Date.UTC(2026, 8, 1);

describe("comment write and read contracts", () => {
  it("keeps reply identities and viewer votes coherent across account removal", async () => {
    const t = createConvexTestWithBetterAuth();
    const [author, reader] = await t.mutation(async (ctx) =>
      Promise.all([
        seedAuthenticatedUser(ctx, {
          now,
          suffix: "comment-author",
        }),
        seedAuthenticatedUser(ctx, {
          now,
          suffix: "comment-reader",
        }),
      ])
    );
    const owner = t.withIdentity({
      subject: author.authUserId,
      sessionId: author.sessionId,
    });
    const viewer = t.withIdentity({
      subject: reader.authUserId,
      sessionId: reader.sessionId,
    });
    const slug = "articles/example";
    const root = await owner.mutation(api.comments.mutations.addComment, {
      slug,
      text: "Question",
    });
    const reply = await viewer.mutation(api.comments.mutations.addComment, {
      slug,
      text: "Answer",
      parentId: root,
    });
    const rejected = await viewer
      .mutation(api.comments.mutations.addComment, {
        slug: "articles/other",
        text: "Wrong parent",
        parentId: root,
      })
      .catch((error: unknown) => error);
    expect(rejected).toMatchObject({
      data: {
        code: "COMMENT_PARENT_MISMATCH",
      },
    });
    if (!Ref.isConvexError(rejected)) {
      throw rejected;
    }
    const decoded = Ref.decodeErrorOption(
      refs.public.comments.mutations.addComment,
      rejected.data
    );
    expect(Option.map(decoded, (error) => error._tag)).toEqual(
      Option.some("CommentWriteError")
    );
    expect(await t.query((ctx) => ctx.db.get("comments", root))).toMatchObject({
      replyCount: 1,
    });
    await expect(
      viewer.mutation(api.comments.mutations.deleteComment, {
        commentId: root,
      })
    ).rejects.toMatchObject({
      data: {
        code: "FORBIDDEN",
      },
    });
    await viewer.mutation(api.comments.mutations.voteOnComment, {
      commentId: root,
      vote: 1,
    });
    const paginationOpts = {
      cursor: null,
      numItems: 20,
    };
    const page = await viewer.query(api.comments.queries.getCommentsBySlug, {
      slug,
      paginationOpts,
    });
    expect(
      Option.getOrUndefined(Arr.findFirst(page.page, (row) => row._id === root))
    ).toMatchObject({
      viewerVote: 1,
      replyToUser: null,
      user: {
        _id: author.userId,
      },
    });
    expect(
      Option.getOrUndefined(
        Arr.findFirst(page.page, (row) => row._id === reply)
      )
    ).toMatchObject({
      viewerVote: null,
      replyToUser: {
        _id: author.userId,
      },
      user: {
        _id: reader.userId,
      },
    });
    expect(
      await viewer.query(api.comments.queries.getCommentsByUserId, {
        userId: author.userId,
        paginationOpts,
      })
    ).toMatchObject({
      page: [
        {
          viewerVote: 1,
        },
      ],
    });
    expect(
      await t.query(api.comments.queries.getCommentsByUserId, {
        userId: author.userId,
        paginationOpts,
      })
    ).toMatchObject({
      page: [
        {
          viewerVote: null,
        },
      ],
    });
    await viewer.mutation(api.comments.mutations.voteOnComment, {
      commentId: root,
      vote: -1,
    });
    await viewer.mutation(api.comments.mutations.voteOnComment, {
      commentId: root,
      vote: 0,
    });
    expect(await t.query((ctx) => ctx.db.get("comments", root))).toMatchObject({
      upvoteCount: 0,
      downvoteCount: 0,
    });
    await t.mutation((ctx) => ctx.db.delete("users", author.userId));
    const after = await t.query(api.comments.queries.getCommentsBySlug, {
      slug,
      paginationOpts,
    });
    expect(
      Option.getOrUndefined(
        Arr.findFirst(after.page, (row) => row._id === root)
      )?.user
    ).toBeNull();
    expect(
      Option.getOrUndefined(
        Arr.findFirst(after.page, (row) => row._id === reply)
      )?.replyToUser
    ).toBeNull();
    await viewer.mutation(api.comments.mutations.deleteComment, {
      commentId: reply,
    });
    await expect(
      viewer.mutation(api.comments.mutations.deleteComment, {
        commentId: reply,
      })
    ).rejects.toMatchObject({
      data: {
        code: "COMMENT_NOT_FOUND",
      },
    });
    await expect(
      viewer.mutation(api.comments.mutations.voteOnComment, {
        commentId: reply,
        vote: 1,
      })
    ).rejects.toMatchObject({
      data: {
        code: "COMMENT_NOT_FOUND",
      },
    });
    await expect(
      viewer.mutation(api.comments.mutations.addComment, {
        slug,
        text: "Missing reply",
        parentId: reply,
      })
    ).rejects.toMatchObject({
      data: {
        code: "COMMENT_PARENT_NOT_FOUND",
      },
    });
  });
});
