import { describe, expect, it } from "@effect/vitest";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import { Array as Arr, Option } from "effect";

const now = Date.UTC(2026, 8, 1);

/** The animal of the author who holds one, as its stored code. */
const CODE = "crab.1.6d4b78.left.smile";

describe("comments/queries", () => {
  it("shows the animal of each author and of each reply target, and leaves it out for an author who holds none", async () => {
    const t = createConvexTestWithBetterAuth();
    const withAnimal = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now,
        suffix: "animal-author",
      });
      await ctx.db.patch("users", user.userId, { mascot: CODE });
      return user;
    });
    const withoutAnimal = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now, suffix: "plain-author" })
    );
    const slug = "articles/animals";
    const question = await t
      .withIdentity({
        subject: withAnimal.authUserId,
        sessionId: withAnimal.sessionId,
      })
      .mutation(api.comments.mutations.addComment, {
        slug,
        text: "Pertanyaan",
      });
    await t
      .withIdentity({
        subject: withoutAnimal.authUserId,
        sessionId: withoutAnimal.sessionId,
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
      _id: withAnimal.userId,
      mascot: CODE,
    });
    expect(rowOf("Pertanyaan")?.replyToUser).toBeNull();
    expect(rowOf("Jawaban")?.user).not.toHaveProperty("mascot");
    expect(rowOf("Jawaban")?.replyToUser).toMatchObject({
      _id: withAnimal.userId,
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
