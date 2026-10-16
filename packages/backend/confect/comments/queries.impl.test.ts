import { describe, expect, it } from "@effect/vitest";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import { MASCOT_CODE } from "@repo/backend/test/mascot";
import { Array as Arr, Option } from "effect";

const now = Date.UTC(2026, 8, 1);

/** The animal of the author who asks, as its stored code, unlike the fixture animal of the author who answers. */
const CODE = "crab.1.6d4b78.left.smile";

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
      paginationOpts: { cursor: null, numItems: 20 },
    });
    const rowOf = (text: string) =>
      Option.getOrUndefined(
        Arr.findFirst(page.page, (row) => row.text === text)
      );

    expect(rowOf("Pertanyaan")?.user).toMatchObject({
      _id: asker.userId,
      mascot: CODE,
    });
    expect(rowOf("Pertanyaan")?.replyToUser).toBeNull();
    expect(rowOf("Jawaban")?.user).toMatchObject({
      _id: answerer.userId,
      mascot: MASCOT_CODE,
    });
    expect(rowOf("Jawaban")?.replyToUser).toMatchObject({
      _id: asker.userId,
      mascot: CODE,
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
      paginationOpts: { cursor: null, numItems: 20 },
    });
    const rowOf = (text: string) =>
      Option.getOrUndefined(
        Arr.findFirst(page.page, (row) => row.text === text)
      );

    expect(rowOf("Pertanyaan lama")?.user).toBeNull();
    expect(rowOf("Jawaban baru")?.replyToUser).toBeNull();
  });
});
