import { DatabaseWriter, RegisteredConvexFunction } from "@confect/server";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { triggers } from "@repo/backend/confect/functions";
import { api, internal } from "@repo/backend/convex/_generated/api";
import { createClassFixture } from "@repo/backend/test/classes";
import { Array as Arr, Effect, Option } from "effect";

const reactions = api.classes.forums.mutations.reactions;
async function createForumFixture() {
  const fixture = await createClassFixture();
  const forumId = await fixture.admin.mutation(
    api.classes.forums.mutations.forums.createForum,
    {
      classId: fixture.classId,
      title: "Algebra reactions",
      body: "Discuss this exercise",
      tag: "general",
    }
  );
  const postId = await fixture.admin.mutation(
    api.classes.forums.mutations.posts.createForumPost,
    {
      forumId,
      body: "A worked solution",
    }
  );
  await fixture.admin.mutation(api.classes.mutations.updateClassVisibility, {
    classId: fixture.classId,
    visibility: "public",
  });
  await fixture.student.mutation(api.classes.mutations.joinPublicClass, {
    classId: fixture.classId,
  });
  return {
    ...fixture,
    forumId,
    postId,
  };
}
describe("registered forum reactions", () => {
  beforeEach(() => vi.setSystemTime(Date.UTC(2026, 8, 1)));
  it("renders retained discussions and reactions after their author is removed", async () => {
    const { t, admin, student, users, classId, forumId, postId } =
      await createForumFixture();
    await admin.mutation(reactions.toggleForumReaction, {
      forumId,
      emoji: "👍",
    });
    await admin.mutation(reactions.togglePostReaction, {
      postId,
      emoji: "👍",
    });
    const replyId = await admin.mutation(
      api.classes.forums.mutations.posts.createForumPost,
      {
        forumId,
        parentId: postId,
        body: "A retained reply",
      }
    );
    await t.mutation((ctx) => ctx.db.delete(users.admin.userId));
    const forum = await student.query(
      api.classes.forums.queries.forums.getForum,
      {
        forumId,
      }
    );
    expect(forum).toMatchObject({
      user: null,
      reactionUsers: [
        {
          count: 1,
          emoji: "👍",
          reactors: ["Unknown"],
        },
      ],
    });
    const list = await student.query(
      api.classes.forums.queries.forums.getForums,
      {
        classId,
        paginationOpts: {
          cursor: null,
          numItems: 10,
        },
      }
    );
    expect(list.page).toMatchObject([
      {
        _id: forumId,
        user: null,
      },
    ]);
    const posts = await student.query(
      api.classes.forums.queries.pages.getForumPosts,
      {
        forumId,
      }
    );
    expect(
      Option.getOrUndefined(Arr.findFirst(posts, (post) => post._id === postId))
    ).toMatchObject({
      user: null,
      reactionUsers: [
        {
          count: 1,
          emoji: "👍",
          reactors: ["Unknown"],
        },
      ],
    });
    expect(
      Option.getOrUndefined(
        Arr.findFirst(posts, (post) => post._id === replyId)
      )
    ).toMatchObject({
      user: null,
      replyToUser: null,
    });
  });
  it("removes a user's reactions when their forum and post have already been deleted", async () => {
    const { t, student, users, forumId, postId } = await createForumFixture();
    await student.mutation(reactions.toggleForumReaction, {
      forumId,
      emoji: "👍",
    });
    await student.mutation(reactions.togglePostReaction, {
      postId,
      emoji: "👍",
    });
    await t.mutation(async (ctx) => {
      await ctx.db.delete(postId);
      await ctx.db.delete(forumId);
    });
    for (let pass = 0; pass < 3; pass += 1) {
      await t.mutation(internal.auth.cleanup.cleanupDeletedUser, {
        userId: users.student.userId,
      });
    }
    expect(
      await t.query(async (ctx) => ({
        forum: await ctx.db.query("schoolClassForumReactions").take(10),
        post: await ctx.db.query("schoolClassForumPostReactions").take(10),
      }))
    ).toEqual({
      forum: [],
      post: [],
    });
  });
  it("updates the forum and post counts atomically and exposes each viewer's reactions", async () => {
    const { t, admin, student, classId, forumId, postId } =
      await createForumFixture();
    for (const viewer of [admin, student]) {
      expect(
        await viewer.mutation(reactions.toggleForumReaction, {
          forumId,
          emoji: "👍",
        })
      ).toEqual({
        added: true,
      });
      expect(
        await viewer.mutation(reactions.togglePostReaction, {
          postId,
          emoji: "👍",
        })
      ).toEqual({
        added: true,
      });
    }
    await t.mutation(async (ctx) => {
      const writer = DatabaseWriter.make(
        databaseSchema,
        triggers.wrapDB(ctx).db
      );
      for (const reaction of await ctx.db
        .query("schoolClassForumReactions")
        .take(10)) {
        await Effect.runPromise(
          writer
            .table("schoolClassForumReactions")
            .patch(reaction._id, {
              emoji: reaction.emoji,
            })
            .pipe(
              Effect.orDie,
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(databaseSchema, ctx)
              )
            )
        );
      }
      for (const reaction of await ctx.db
        .query("schoolClassForumPostReactions")
        .take(10)) {
        await Effect.runPromise(
          writer
            .table("schoolClassForumPostReactions")
            .patch(reaction._id, {
              emoji: reaction.emoji,
            })
            .pipe(
              Effect.orDie,
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(databaseSchema, ctx)
              )
            )
        );
      }
    });
    const forum = await admin.query(
      api.classes.forums.queries.forums.getForum,
      {
        forumId,
      }
    );
    expect(forum).toMatchObject({
      reactionCounts: [
        {
          emoji: "👍",
          count: 2,
        },
      ],
      myReactions: ["👍"],
      reactionUsers: [
        {
          emoji: "👍",
          count: 2,
          reactors: expect.arrayContaining([
            "User class-admin",
            "User class-student",
          ]),
        },
      ],
    });
    const posts = await admin.query(
      api.classes.forums.queries.pages.getForumPosts,
      {
        forumId,
      }
    );
    expect(posts).toMatchObject([
      {
        _id: postId,
        reactionCounts: [
          {
            emoji: "👍",
            count: 2,
          },
        ],
        myReactions: ["👍"],
      },
    ]);
    for (const q of [undefined, "Algebra"]) {
      const list = await admin.query(
        api.classes.forums.queries.forums.getForums,
        {
          classId,
          ...(q === undefined
            ? {}
            : {
                q,
              }),
          paginationOpts: {
            cursor: null,
            numItems: 10,
          },
        }
      );
      expect(list.page).toMatchObject([
        {
          _id: forumId,
          myReactions: ["👍"],
          unreadCount: 0,
        },
      ]);
    }
    for (const viewer of [admin, student]) {
      expect(
        await viewer.mutation(reactions.toggleForumReaction, {
          forumId,
          emoji: "👍",
        })
      ).toEqual({
        added: false,
      });
      expect(
        await viewer.mutation(reactions.togglePostReaction, {
          postId,
          emoji: "👍",
        })
      ).toEqual({
        added: false,
      });
    }
    const state = await t.query(async (ctx) => ({
      forum: await ctx.db.get("schoolClassForums", forumId),
      post: await ctx.db.get("schoolClassForumPosts", postId),
      forumReactions: await ctx.db.query("schoolClassForumReactions").take(10),
      postReactions: await ctx.db
        .query("schoolClassForumPostReactions")
        .take(10),
    }));
    expect(state).toMatchObject({
      forum: {
        reactionCounts: [],
      },
      post: {
        reactionCounts: [],
      },
      forumReactions: [],
      postReactions: [],
    });
  });
  it("rejects invalid values and unauthorized reactions without changing counts", async () => {
    const { t, admin, outsider, classId, forumId, postId } =
      await createForumFixture();
    for (const emoji of ["", "text", "👍".repeat(33)]) {
      await expect(
        admin.mutation(reactions.toggleForumReaction, {
          forumId,
          emoji,
        })
      ).rejects.toThrow("FORUM_REACTION_INVALID");
      await expect(
        admin.mutation(reactions.togglePostReaction, {
          postId,
          emoji,
        })
      ).rejects.toThrow("FORUM_REACTION_INVALID");
    }
    await expect(
      outsider.mutation(reactions.toggleForumReaction, {
        forumId,
        emoji: "👍",
      })
    ).rejects.toThrow("ACCESS_DENIED");
    await expect(
      outsider.mutation(reactions.togglePostReaction, {
        postId,
        emoji: "👍",
      })
    ).rejects.toThrow("ACCESS_DENIED");
    await t.mutation((ctx) =>
      ctx.db.patch("schoolClasses", classId, {
        isArchived: true,
      })
    );
    await expect(
      admin.mutation(reactions.toggleForumReaction, {
        forumId,
        emoji: "👍",
      })
    ).rejects.toThrow("CLASS_ARCHIVED");
    await expect(
      admin.mutation(reactions.togglePostReaction, {
        postId,
        emoji: "👍",
      })
    ).rejects.toThrow("CLASS_ARCHIVED");
    await t.mutation((ctx) => ctx.db.delete("schoolClassForumPosts", postId));
    await expect(
      admin.mutation(reactions.togglePostReaction, {
        postId,
        emoji: "👍",
      })
    ).rejects.toThrow("POST_NOT_FOUND");
  });
  it("allows existing variants and removal at the limit while rejecting new variants", async () => {
    const { admin, student, forumId, postId } = await createForumFixture();
    const emojis = [
      "👍",
      "👎",
      "😀",
      "😃",
      "😄",
      "😁",
      "😆",
      "😅",
      "😂",
      "🤣",
      "😊",
      "😇",
      "🙂",
      "🙃",
      "😉",
      "😌",
      "😍",
      "🥰",
      "😘",
      "😗",
    ];
    for (const emoji of emojis) {
      await admin.mutation(reactions.toggleForumReaction, {
        forumId,
        emoji,
      });
      await admin.mutation(reactions.togglePostReaction, {
        postId,
        emoji,
      });
    }
    await expect(
      admin.mutation(reactions.toggleForumReaction, {
        forumId,
        emoji: "🤔",
      })
    ).rejects.toThrow("FORUM_REACTION_VARIANT_LIMIT_EXCEEDED");
    await expect(
      admin.mutation(reactions.togglePostReaction, {
        postId,
        emoji: "🤔",
      })
    ).rejects.toThrow("FORUM_REACTION_VARIANT_LIMIT_EXCEEDED");
    expect(
      await student.mutation(reactions.toggleForumReaction, {
        forumId,
        emoji: "👍",
      })
    ).toEqual({
      added: true,
    });
    expect(
      await student.mutation(reactions.togglePostReaction, {
        postId,
        emoji: "👍",
      })
    ).toEqual({
      added: true,
    });
    expect(
      await admin.mutation(reactions.toggleForumReaction, {
        forumId,
        emoji: "😗",
      })
    ).toEqual({
      added: false,
    });
    expect(
      await admin.mutation(reactions.togglePostReaction, {
        postId,
        emoji: "😗",
      })
    ).toEqual({
      added: false,
    });
    expect(
      await admin.mutation(reactions.toggleForumReaction, {
        forumId,
        emoji: "🤔",
      })
    ).toEqual({
      added: true,
    });
    expect(
      await admin.mutation(reactions.togglePostReaction, {
        postId,
        emoji: "🤔",
      })
    ).toEqual({
      added: true,
    });
  });
});
