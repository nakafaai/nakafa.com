import { Ref } from "@confect/core";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { POST_PAGE_SIZE } from "@repo/backend/client/posts/list";
import type { Id } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { seedSchoolMember } from "@repo/backend/test/member";
import { Array as Arr, Option, Order, Record } from "effect";

const create = Ref.getFunctionReference(refs.public.posts.mutations.create);
const like = Ref.getFunctionReference(refs.public.posts.mutations.like);
const list = Ref.getFunctionReference(refs.public.posts.queries.list);
type ListPage = Ref.Returns<typeof refs.public.posts.queries.list>;

const now = Date.UTC(2026, 8, 1);

/** The first page the profile asks for, at the size the profile asks with. */
const PAGE = { cursor: null, numItems: POST_PAGE_SIZE };

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
  it("lists the author's posts newest first, one page at a time, and each row shows only its own fields", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    const { author } = await createReaders();
    const texts = Arr.makeBy(
      POST_PAGE_SIZE + 1,
      (index) => `Post ${index + 1}`
    );
    await writePosts(author, texts);
    const first: ListPage = await author.session.query(list, {
      authorId: author.userId,
      paginationOpts: PAGE,
    });
    expect(Arr.map(first.page, (post) => post.text)).toEqual(
      Arr.take(Arr.reverse(texts), POST_PAGE_SIZE)
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
      paginationOpts: {
        cursor: first.continueCursor,
        numItems: POST_PAGE_SIZE,
      },
    });
    expect(Arr.map(second.page, (post) => post.text)).toEqual(["Post 1"]);
    expect(second.isDone).toBe(true);
  });

  it("holds at most one page of posts, however many the caller asks for, and reaches the rest after it", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    const { author } = await createReaders();
    await writePosts(
      author,
      Arr.makeBy(POST_PAGE_SIZE + 1, (index) => `Post ${index + 1}`)
    );
    const asked: ListPage = await author.session.query(list, {
      authorId: author.userId,
      paginationOpts: { cursor: null, numItems: 1_000_000 },
    });
    expect(asked.page).toHaveLength(POST_PAGE_SIZE);
    expect(asked.isDone).toBe(false);
    const rest: ListPage = await author.session.query(list, {
      authorId: author.userId,
      paginationOpts: { cursor: asked.continueCursor, numItems: 1_000_000 },
    });
    expect(rest.page).toHaveLength(1);
    expect(rest.isDone).toBe(true);
  });

  it("does not let a range end from the caller widen a page past its size", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    const { author } = await createReaders();
    await writePosts(
      author,
      Arr.makeBy(POST_PAGE_SIZE + 10, (index) => `Post ${index + 1}`)
    );
    const first: ListPage = await author.session.query(list, {
      authorId: author.userId,
      paginationOpts: PAGE,
    });
    // Five more posts, so the range end below sits past the first page.
    const beyond: ListPage = await author.session.query(list, {
      authorId: author.userId,
      paginationOpts: { cursor: first.continueCursor, numItems: 5 },
    });
    const widened: ListPage = await author.session.query(list, {
      authorId: author.userId,
      paginationOpts: {
        cursor: null,
        endCursor: beyond.continueCursor,
        numItems: 1_000_000,
      },
    });
    expect(widened.page).toHaveLength(POST_PAGE_SIZE);
    expect(widened.page).toEqual(first.page);
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

  it("reads the posts and their counts to another learner and to a signed-out caller, and tells each caller only its own likes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    const { anonymous, author, stranger } = await createReaders();
    const [first, second] = await writePosts(author, ["Disukai", "Tidak"]);
    await author.session.mutation(like, { postId: first });
    await stranger.mutation(like, { postId: second });
    const readAs = (caller: Pick<typeof anonymous, "query">) =>
      caller.query(list, { authorId: author.userId, paginationOpts: PAGE });
    // The newest post comes first. The stranger sees its own like on the second
    // post, and the author's like on the first post only as a count.
    expect(await readAs(stranger)).toMatchObject({
      isDone: true,
      page: [
        expect.objectContaining({ _id: second, likeCount: 1, liked: true }),
        expect.objectContaining({ _id: first, likeCount: 1, liked: false }),
      ],
    });
    // A signed-out caller reads the same counts, and has liked nothing.
    expect(await readAs(anonymous)).toMatchObject({
      isDone: true,
      page: [
        expect.objectContaining({ _id: second, likeCount: 1, liked: false }),
        expect.objectContaining({ _id: first, likeCount: 1, liked: false }),
      ],
    });
  });

  it("reads a school member's posts to the member alone, and an empty page to anyone else (K15)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    const { anonymous, author, stranger } = await createReaders();
    const [post] = await writePosts(author, ["Catatan kelas"]);
    await anonymous.mutation((ctx) =>
      seedSchoolMember(ctx, author.userId, now)
    );
    const readAs = (caller: Pick<typeof anonymous, "query">) =>
      caller.query(list, { authorId: author.userId, paginationOpts: PAGE });
    expect(await readAs(author.session)).toMatchObject({
      page: [expect.objectContaining({ _id: post })],
    });
    const empty = { continueCursor: "", isDone: true, page: [] };
    expect(await readAs(stranger)).toStrictEqual(empty);
    expect(await readAs(anonymous)).toStrictEqual(empty);
  });
});
