import { Ref } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { LEARNER_TEXT_MAX_LENGTH } from "@repo/backend/confect/writing/text";
import { api } from "@repo/backend/convex/_generated/api";
import { Array as Arr, Option } from "effect";

const now = Date.UTC(2026, 8, 1);
const likeComment = Ref.getFunctionReference(
  refs.public.comments.mutations.likeComment
);
const unlikeComment = Ref.getFunctionReference(
  refs.public.comments.mutations.unlikeComment
);
const getCommentReplies = Ref.getFunctionReference(
  refs.public.comments.queries.getCommentReplies
);
/** A page of replies as the server answers it, decoded with the schema of the function. */
const decodeReplies = (answer: unknown) =>
  Ref.decodeReturnsSync(refs.public.comments.queries.getCommentReplies, answer);
const paginationOpts = { cursor: null, numItems: 20 };

/** An author and a reader, both signed in, with the clients that act as each of them. */
async function createLearners() {
  const t = createConvexTestWithBetterAuth();
  const [author, reader] = await t.mutation(async (ctx) =>
    Promise.all([
      seedAuthenticatedUser(ctx, { now, suffix: "comment-author" }),
      seedAuthenticatedUser(ctx, { now, suffix: "comment-reader" }),
    ])
  );
  return {
    t,
    author: {
      session: t.withIdentity({
        subject: author.authUserId,
        sessionId: author.sessionId,
      }),
      userId: author.userId,
    },
    reader: {
      session: t.withIdentity({
        subject: reader.authUserId,
        sessionId: reader.sessionId,
      }),
      userId: reader.userId,
    },
  };
}

describe("comment write and read contracts", () => {
  it("keeps reply identities and viewer likes coherent across account removal", async () => {
    const { t, author, reader } = await createLearners();
    const slug = "articles/example";
    const root = await author.session.mutation(
      api.comments.mutations.addComment,
      { slug, text: "Question" }
    );
    const reply = await reader.session.mutation(
      api.comments.mutations.addComment,
      { slug, text: "Answer", parentId: root }
    );
    const rejected = await reader.session
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
      reader.session.mutation(api.comments.mutations.deleteComment, {
        commentId: root,
      })
    ).rejects.toMatchObject({
      data: {
        code: "FORBIDDEN",
      },
    });
    await reader.session.mutation(likeComment, {
      commentId: root,
    });
    const page = await reader.session.query(
      api.comments.queries.getCommentsBySlug,
      { slug, paginationOpts }
    );
    expect(
      Option.getOrUndefined(Arr.findFirst(page.page, (row) => row._id === root))
    ).toMatchObject({
      liked: true,
      likeCount: 1,
      replyToUser: null,
      user: {
        _id: author.userId,
      },
    });
    const thread = decodeReplies(
      await reader.session.query(getCommentReplies, {
        threadId: root,
        paginationOpts,
      })
    );
    expect(thread.page).toMatchObject([
      {
        _id: reply,
        liked: false,
        likeCount: 0,
        replyToUser: {
          _id: author.userId,
        },
        user: {
          _id: reader.userId,
        },
      },
    ]);
    expect(
      await reader.session.query(api.comments.queries.getCommentsByUserId, {
        userId: author.userId,
        paginationOpts,
      })
    ).toMatchObject({
      page: [
        {
          liked: true,
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
          liked: false,
        },
      ],
    });
    await reader.session.mutation(unlikeComment, {
      commentId: root,
    });
    expect(await t.query((ctx) => ctx.db.get("comments", root))).toMatchObject({
      likeCount: 0,
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
    const afterThread = decodeReplies(
      await t.query(getCommentReplies, {
        threadId: root,
        paginationOpts,
      })
    );
    expect(afterThread.page[0]?.replyToUser).toBeNull();
    await reader.session.mutation(api.comments.mutations.deleteComment, {
      commentId: reply,
    });
    await expect(
      reader.session.mutation(api.comments.mutations.deleteComment, {
        commentId: reply,
      })
    ).rejects.toMatchObject({
      data: {
        code: "COMMENT_NOT_FOUND",
      },
    });
    await expect(
      reader.session.mutation(likeComment, {
        commentId: reply,
      })
    ).rejects.toMatchObject({
      data: {
        code: "COMMENT_NOT_FOUND",
      },
    });
    await expect(
      reader.session.mutation(api.comments.mutations.addComment, {
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

  it("places a reply to a reply in the thread of its top-level comment, and reads the thread oldest first", async () => {
    const { t, author, reader } = await createLearners();
    const slug = "articles/threads";
    const root = await author.session.mutation(
      api.comments.mutations.addComment,
      { slug, text: "Root" }
    );
    const first = await reader.session.mutation(
      api.comments.mutations.addComment,
      { slug, text: "First reply", parentId: root }
    );
    const nested = await author.session.mutation(
      api.comments.mutations.addComment,
      { slug, text: "Reply to the reply", parentId: first }
    );
    expect(await t.query((ctx) => ctx.db.get("comments", first))).toMatchObject(
      { parentId: root, threadId: root }
    );
    expect(
      await t.query((ctx) => ctx.db.get("comments", nested))
    ).toMatchObject({
      parentId: first,
      replyToUserId: reader.userId,
      threadId: root,
    });
    const rootAfterReplies = await t.query((ctx) =>
      ctx.db.get("comments", root)
    );
    expect(rootAfterReplies).toMatchObject({ replyCount: 2 });
    expect(rootAfterReplies).not.toHaveProperty("threadId");
    const thread = decodeReplies(
      await t.query(getCommentReplies, {
        threadId: root,
        paginationOpts,
      })
    );
    expect(Arr.map(thread.page, (row) => row._id)).toEqual([first, nested]);
    const top = await t.query(api.comments.queries.getCommentsBySlug, {
      slug,
      paginationOpts,
    });
    expect(Arr.map(top.page, (row) => row._id)).toEqual([root]);
  });

  it("stores the trimmed text of a comment, and refuses an empty or an over-long text", async () => {
    const { t, author } = await createLearners();
    const slug = "articles/text";
    const commentId = await author.session.mutation(
      api.comments.mutations.addComment,
      { slug, text: "  Halo.  " }
    );
    expect(
      await t.query((ctx) => ctx.db.get("comments", commentId))
    ).toMatchObject({ text: "Halo." });
    await expect(
      author.session.mutation(api.comments.mutations.addComment, {
        slug,
        text: " \n ",
      })
    ).rejects.toMatchObject({
      data: { code: "POST_TEXT_EMPTY" },
    });
    await expect(
      author.session.mutation(api.comments.mutations.addComment, {
        slug,
        text: "a".repeat(LEARNER_TEXT_MAX_LENGTH + 1),
      })
    ).rejects.toMatchObject({
      data: {
        code: "POST_TEXT_TOO_LONG",
        message: `The comment must hold 1 to ${LEARNER_TEXT_MAX_LENGTH} characters.`,
      },
    });
  });

  it("keeps the like count and the like rows exact when a like or an unlike repeats", async () => {
    const { t, author, reader } = await createLearners();
    const commentId = await author.session.mutation(
      api.comments.mutations.addComment,
      { slug: "articles/likes", text: "Liked" }
    );
    const count = () =>
      t
        .query((ctx) => ctx.db.get("comments", commentId))
        .then((comment) => comment?.likeCount);
    const likeRows = () =>
      t
        .query((ctx) => ctx.db.query("commentLikes").collect())
        .then((rows) => rows.length);
    await reader.session.mutation(likeComment, {
      commentId,
    });
    await reader.session.mutation(likeComment, {
      commentId,
    });
    expect(await count()).toBe(1);
    expect(await likeRows()).toBe(1);
    await author.session.mutation(likeComment, {
      commentId,
    });
    expect(await count()).toBe(2);
    await reader.session.mutation(unlikeComment, {
      commentId,
    });
    await reader.session.mutation(unlikeComment, {
      commentId,
    });
    expect(await count()).toBe(1);
    expect(await likeRows()).toBe(1);
  });

  it("refuses a like and an unlike on a comment that is gone", async () => {
    const { author, reader } = await createLearners();
    const commentId = await author.session.mutation(
      api.comments.mutations.addComment,
      { slug: "articles/gone", text: "Removed" }
    );
    await author.session.mutation(api.comments.mutations.deleteComment, {
      commentId,
    });
    await expect(
      reader.session.mutation(likeComment, { commentId })
    ).rejects.toMatchObject({ data: { code: "COMMENT_NOT_FOUND" } });
    await expect(
      reader.session.mutation(unlikeComment, {
        commentId,
      })
    ).rejects.toMatchObject({ data: { code: "COMMENT_NOT_FOUND" } });
  });
});
