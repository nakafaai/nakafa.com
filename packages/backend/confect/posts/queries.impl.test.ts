import { Ref } from "@confect/core";
import { afterEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Option, Order, Record } from "effect";

const create = Ref.getFunctionReference(refs.public.posts.mutations.create);
const like = Ref.getFunctionReference(refs.public.posts.mutations.like);
const list = Ref.getFunctionReference(refs.public.posts.queries.list);
type ListPage = Ref.Returns<typeof refs.public.posts.queries.list>;

const now = Date.UTC(2026, 8, 1);

/** The page size the profile asks for: twenty posts the first time. */
const PAGE = { cursor: null, numItems: 20 };

afterEach(() => vi.useRealTimers());

/** Creates an author, another learner, and a signed-out caller of the same posts. */
async function createReaders() {
  const t = createConvexTestWithBetterAuth();
  const [author, stranger] = await t.mutation(async (ctx) =>
    Promise.all([
      seedAuthenticatedUser(ctx, { now, suffix: "list-author" }),
      seedAuthenticatedUser(ctx, { now, suffix: "list-stranger" }),
    ])
  );
  return {
    anonymous: t,
    author: {
      session: t.withIdentity({
        subject: author.authUserId,
        sessionId: author.sessionId,
      }),
      userId: author.userId,
    },
    stranger: t.withIdentity({
      subject: stranger.authUserId,
      sessionId: stranger.sessionId,
    }),
  };
}

/** Writes posts one millisecond apart, in order, so their creation order is certain. */
function writePosts(
  author: Awaited<ReturnType<typeof createReaders>>["author"],
  texts: readonly string[]
): Promise<readonly Id<"posts">[]> {
  return Arr.reduce(
    texts,
    Promise.resolve<readonly Id<"posts">[]>([]),
    async (previous, text, index) => {
      const ids = await previous;
      vi.setSystemTime(now + index);
      return Arr.append(ids, await author.session.mutation(create, { text }));
    }
  );
}

describe("posts list contract", () => {
  it("lists the author's posts newest first, twenty to a page, and each row shows only its own fields", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    const { author } = await createReaders();
    const texts = Arr.makeBy(21, (index) => `Post ${index + 1}`);
    await writePosts(author, texts);
    const first: ListPage = await author.session.query(list, {
      authorId: author.userId,
      paginationOpts: PAGE,
    });
    expect(Arr.map(first.page, (post) => post.text)).toEqual(
      Arr.take(Arr.reverse(texts), 20)
    );
    expect(first.isDone).toBe(false);
    expect(
      Option.map(Arr.head(first.page), (post) =>
        Arr.sort(Record.keys(post), Order.String)
      )
    ).toEqual(
      Option.some(["_creationTime", "_id", "likeCount", "liked", "text"])
    );
    const second: ListPage = await author.session.query(list, {
      authorId: author.userId,
      paginationOpts: { cursor: first.continueCursor, numItems: 20 },
    });
    expect(Arr.map(second.page, (post) => post.text)).toEqual(["Post 1"]);
    expect(second.isDone).toBe(true);
  });

  it("tells the author which posts they have liked, and counts each like", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    const { author } = await createReaders();
    const [liked, unliked] = await writePosts(author, ["Disukai", "Tidak"]);
    await author.session.mutation(like, { postId: liked });
    const page: ListPage = await author.session.query(list, {
      authorId: author.userId,
      paginationOpts: PAGE,
    });
    expect(page.page).toEqual([
      expect.objectContaining({ _id: unliked, liked: false, likeCount: 0 }),
      expect.objectContaining({ _id: liked, liked: true, likeCount: 1 }),
    ]);
  });

  it("answers nothing to another learner or to a signed-out caller", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    const { anonymous, author, stranger } = await createReaders();
    await writePosts(author, ["Hanya untuk pemilik"]);
    const nothing = {
      isDone: true,
      page: [],
    };
    expect(
      await stranger.query(list, {
        authorId: author.userId,
        paginationOpts: PAGE,
      })
    ).toMatchObject(nothing);
    expect(
      await anonymous.query(list, {
        authorId: author.userId,
        paginationOpts: PAGE,
      })
    ).toMatchObject(nothing);
  });
});
