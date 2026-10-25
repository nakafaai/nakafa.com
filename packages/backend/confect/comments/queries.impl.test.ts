import { Ref } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import { MASCOT } from "@repo/backend/test/mascot";
import { MascotCode } from "@repo/mascot/code";
import { Array as Arr, Option, Schema } from "effect";

const now = Date.UTC(2026, 8, 1);
const likeComment = Ref.getFunctionReference(
  refs.public.comments.mutations.likeComment
);
const getCommentReplies = Ref.getFunctionReference(
  refs.public.comments.queries.getCommentReplies
);
/** A page of replies as the server answers it, decoded with the schema of the function. */
const decodeReplies = (answer: unknown) =>
  Ref.decodeReturnsSync(refs.public.comments.queries.getCommentReplies, answer);
const paginationOpts = { cursor: null, numItems: 20 };

/** The animal of the author who asks, as its stored code, unlike the fixture animal of the author who answers. */
const CODE = "crab.1.6d4b78.left.smile";
/** The same animal decoded, as a read through a function's schema shows it. */
const DECODED_CODE = Schema.decodeSync(MascotCode)(CODE);

/** The row with this text on a page, or undefined when the page has none. */
function rowOf<T extends { text: string }>(page: readonly T[], text: string) {
  return Option.getOrUndefined(Arr.findFirst(page, (row) => row.text === text));
}

describe("comments/queries", () => {
  it("shows the animal of each author and of each reply target", async () => {
    const t = createConvexTestWithBetterAuth();
    const asker = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now,
        suffix: "asking-author",
      });
      await ctx.db.patch("users", user.userId, { mascot: CODE });
      return user;
    });
    const answerer = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now, suffix: "answering-author" })
    );
    const slug = "articles/animals";
    const question = await t
      .withIdentity({
        subject: asker.authUserId,
        sessionId: asker.sessionId,
      })
      .mutation(api.comments.mutations.addComment, {
        slug,
        text: "Pertanyaan",
      });
    await t
      .withIdentity({
        subject: answerer.authUserId,
        sessionId: answerer.sessionId,
      })
      .mutation(api.comments.mutations.addComment, {
        slug,
        text: "Jawaban",
        parentId: question,
      });

    const page = await t.query(api.comments.queries.getCommentsBySlug, {
      slug,
      paginationOpts,
    });
    const replies = decodeReplies(
      await t.query(getCommentReplies, {
        threadId: question,
        paginationOpts,
      })
    );

    expect(rowOf(page.page, "Pertanyaan")?.user).toMatchObject({
      _id: asker.userId,
      mascot: CODE,
    });
    expect(rowOf(page.page, "Pertanyaan")?.replyToUser).toBeNull();
    // A reply is read through its schema, which decodes the stored animal code.
    expect(rowOf(replies.page, "Jawaban")?.user).toMatchObject({
      _id: answerer.userId,
      mascot: MASCOT,
    });
    expect(rowOf(replies.page, "Jawaban")?.replyToUser).toMatchObject({
      _id: asker.userId,
      mascot: DECODED_CODE,
    });
  });

  it("shows no author for a comment and no reply target whose author row no longer exists", async () => {
    const t = createConvexTestWithBetterAuth();
    const gone = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now, suffix: "gone-author" })
    );
    const replier = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now, suffix: "replier" })
    );
    const slug = "articles/removed";
    const question = await t
      .withIdentity({ subject: gone.authUserId, sessionId: gone.sessionId })
      .mutation(api.comments.mutations.addComment, {
        slug,
        text: "Pertanyaan lama",
      });
    await t
      .withIdentity({
        subject: replier.authUserId,
        sessionId: replier.sessionId,
      })
      .mutation(api.comments.mutations.addComment, {
        slug,
        text: "Jawaban baru",
        parentId: question,
      });
    await t.mutation((ctx) => ctx.db.delete("users", gone.userId));

    const page = await t.query(api.comments.queries.getCommentsBySlug, {
      slug,
      paginationOpts,
    });
    const replies = decodeReplies(
      await t.query(getCommentReplies, {
        threadId: question,
        paginationOpts,
      })
    );

    expect(rowOf(page.page, "Pertanyaan lama")?.user).toBeNull();
    expect(rowOf(replies.page, "Jawaban baru")?.replyToUser).toBeNull();
  });

  it("shows an author's Google photo only while the author shows it", async () => {
    const t = createConvexTestWithBetterAuth();
    const asker = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now,
        suffix: "photo-asker",
      });
      await ctx.db.patch("users", user.userId, {
        image: "https://example.com/photo-asker.png",
      });
      return user;
    });
    const answerer = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now,
        suffix: "photo-answerer",
      });
      await ctx.db.patch("users", user.userId, {
        image: "https://example.com/photo-answerer.png",
        picture: "photo",
      });
      return user;
    });
    const slug = "articles/photos";
    const question = await t
      .withIdentity({
        subject: asker.authUserId,
        sessionId: asker.sessionId,
      })
      .mutation(api.comments.mutations.addComment, {
        slug,
        text: "Pertanyaan foto",
      });
    await t
      .withIdentity({
        subject: answerer.authUserId,
        sessionId: answerer.sessionId,
      })
      .mutation(api.comments.mutations.addComment, {
        slug,
        text: "Jawaban foto",
        parentId: question,
      });

    const page = await t.query(api.comments.queries.getCommentsBySlug, {
      slug,
      paginationOpts,
    });
    const replies = decodeReplies(
      await t.query(getCommentReplies, {
        threadId: question,
        paginationOpts,
      })
    );

    // The asker keeps the animal, so the asker's photo stays off the server
    // both as the author and as the reply target.
    expect(rowOf(page.page, "Pertanyaan foto")?.user).not.toHaveProperty(
      "image"
    );
    expect(rowOf(replies.page, "Jawaban foto")?.user).toMatchObject({
      image: "https://example.com/photo-answerer.png",
      picture: "photo",
    });
    expect(rowOf(replies.page, "Jawaban foto")?.replyToUser).not.toHaveProperty(
      "image"
    );
  });

  it("lists only the top-level comments of a slug, and says which of them the viewer liked", async () => {
    const t = createConvexTestWithBetterAuth();
    const author = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now, suffix: "list-author" })
    );
    const reader = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now, suffix: "list-reader" })
    );
    const authorClient = t.withIdentity({
      subject: author.authUserId,
      sessionId: author.sessionId,
    });
    const readerClient = t.withIdentity({
      subject: reader.authUserId,
      sessionId: reader.sessionId,
    });
    const slug = "articles/listing";
    const root = await authorClient.mutation(
      api.comments.mutations.addComment,
      { slug, text: "Akar" }
    );
    await readerClient.mutation(api.comments.mutations.addComment, {
      slug,
      text: "Balasan",
      parentId: root,
    });
    await readerClient.mutation(likeComment, {
      commentId: root,
    });

    const signedIn = await readerClient.query(
      api.comments.queries.getCommentsBySlug,
      { slug, paginationOpts }
    );
    const signedOut = await t.query(api.comments.queries.getCommentsBySlug, {
      slug,
      paginationOpts,
    });

    expect(signedIn.page).toMatchObject([
      { _id: root, liked: true, likeCount: 1, replyCount: 1 },
    ]);
    expect(signedOut.page).toMatchObject([
      { _id: root, liked: false, likeCount: 1 },
    ]);
  });

  it("reads a comment written before the like count with a count of zero", async () => {
    const t = createConvexTestWithBetterAuth();
    const author = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now, suffix: "legacy-author" })
    );
    const slug = "articles/legacy";
    await t.mutation((ctx) =>
      ctx.db.insert("comments", {
        slug,
        text: "Ditulis sebelum hitungan suka",
        replyCount: 0,
        userId: author.userId,
      })
    );

    const page = await t.query(api.comments.queries.getCommentsBySlug, {
      slug,
      paginationOpts,
    });

    expect(page.page).toMatchObject([
      {
        likeCount: 0,
        liked: false,
      },
    ]);
  });
});
