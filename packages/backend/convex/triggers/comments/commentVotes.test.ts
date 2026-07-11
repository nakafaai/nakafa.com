import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 4, 29, 18, 0, 0);

describe("triggers/comments/commentVotes", () => {
  it("keeps denormalized vote counts in sync through comment mutations", async () => {
    const t = createConvexTestWithBetterAuth();
    const users = await t.mutation(async (ctx) => ({
      author: await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "vote-author",
      }),
      voter: await seedAuthenticatedUser(ctx, {
        now: NOW,
        sessionToken: "session-vote-voter",
        suffix: "vote-voter",
      }),
    }));
    const author = t.withIdentity({
      sessionId: users.author.sessionId,
      subject: users.author.authUserId,
    });
    const voter = t.withIdentity({
      sessionId: users.voter.sessionId,
      subject: users.voter.authUserId,
    });

    const commentId = await author.mutation(api.comments.mutations.addComment, {
      slug: "/en/articles/politics/votes",
      text: "Comment with votes",
    });

    await voter.mutation(api.comments.mutations.voteOnComment, {
      commentId,
      vote: 1,
    });

    const [slugComments, userComments, guestComments] = await Promise.all([
      voter.query(api.comments.queries.getCommentsBySlug, {
        paginationOpts: { cursor: null, numItems: 10 },
        slug: "/en/articles/politics/votes",
      }),
      voter.query(api.comments.queries.getCommentsByUserId, {
        paginationOpts: { cursor: null, numItems: 10 },
        userId: users.author.userId,
      }),
      t.query(api.comments.queries.getCommentsBySlug, {
        paginationOpts: { cursor: null, numItems: 10 },
        slug: "/en/articles/politics/votes",
      }),
    ]);
    expect(slugComments.page[0].viewerVote).toBe(1);
    expect(userComments.page[0].viewerVote).toBe(1);
    expect(guestComments.page[0].viewerVote).toBeNull();

    const upvoted = await t.query(async (ctx) =>
      ctx.db.get("comments", commentId)
    );
    expect(upvoted).toMatchObject({
      downvoteCount: 0,
      upvoteCount: 1,
    });

    await voter.mutation(api.comments.mutations.voteOnComment, {
      commentId,
      vote: -1,
    });

    const downvoted = await t.query(async (ctx) =>
      ctx.db.get("comments", commentId)
    );
    expect(downvoted).toMatchObject({
      downvoteCount: 1,
      upvoteCount: 0,
    });

    await voter.mutation(api.comments.mutations.voteOnComment, {
      commentId,
      vote: 0,
    });

    const removed = await t.query(async (ctx) =>
      ctx.db.get("comments", commentId)
    );
    expect(removed).toMatchObject({
      downvoteCount: 0,
      upvoteCount: 0,
    });
  });
});
