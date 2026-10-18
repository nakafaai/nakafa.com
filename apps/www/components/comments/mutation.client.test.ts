import { Ref } from "@confect/core";
import type * as OptimisticLocalStore from "@confect/react/OptimisticLocalStore";
import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import comments from "@repo/backend/confect/_generated/refs/comments";
import { MASCOT } from "@repo/backend/test/mascot";
import { Array as Arr, Equal, MutableRef, Option, Schema } from "effect";
import {
  insertDraftComment,
  insertDraftReply,
  likeInLists,
  removeFromLists,
  unlikeInLists,
} from "@/components/comments/mutation.client";
import type { CommentRow } from "@/components/comments/state";

const commentId = Schema.decodeUnknownSync(Id("comments"));
const userId = Schema.decodeUnknownSync(Id("users"));
const AUTHOR = userId("author");
const SLUG = "lesson";
const ROOT = commentId("root");
const OTHER = commentId("other");

/** A comment as the content page's lists hold it. */
function row(id: string, change: Partial<CommentRow> = {}): CommentRow {
  return {
    _creationTime: 1,
    _id: commentId(id),
    downvoteCount: 0,
    likeCount: 0,
    liked: false,
    replyCount: 0,
    replyToUser: null,
    slug: SLUG,
    text: id,
    upvoteCount: 0,
    user: { _id: AUTHOR, mascot: MASCOT, name: "Author" },
    userId: AUTHOR,
    viewerVote: null,
    ...change,
  };
}

/** One cached query: the name of its function, its encoded arguments, and its encoded answer, or none while it loads. */
type Cached = readonly [name: string, args: unknown, value: unknown];

/** A page of the top-level comments of a slug. */
function slugList(
  cursor: string | null,
  page: CommentRow[],
  slug = SLUG,
  isDone = false
): Cached {
  return [
    Ref.getConvexFunctionName(comments.queries.getCommentsBySlug),
    Ref.encodeArgsSync(comments.queries.getCommentsBySlug, {
      paginationOpts: { cursor, numItems: 25 },
      slug,
    }),
    Ref.encodeReturnsSync(comments.queries.getCommentsBySlug, {
      continueCursor: "next",
      isDone,
      page,
    }),
  ];
}

/** A page of the replies of a thread. */
function replyList(
  threadId: Id<"comments">,
  page: CommentRow[],
  isDone: boolean
): Cached {
  return [
    Ref.getConvexFunctionName(comments.queries.getCommentReplies),
    Ref.encodeArgsSync(comments.queries.getCommentReplies, {
      paginationOpts: { cursor: null, numItems: 25 },
      threadId,
    }),
    Ref.encodeReturnsSync(comments.queries.getCommentReplies, {
      continueCursor: "next",
      isDone,
      page,
    }),
  ];
}

/** The profile's comments, which carry no author of their own. */
function profileList(page: CommentRow[]): Cached {
  return [
    Ref.getConvexFunctionName(comments.queries.getCommentsByUserId),
    Ref.encodeArgsSync(comments.queries.getCommentsByUserId, {
      paginationOpts: { cursor: null, numItems: 25 },
      userId: AUTHOR,
    }),
    Ref.encodeReturnsSync(comments.queries.getCommentsByUserId, {
      continueCursor: "next",
      isDone: true,
      page: Arr.map(
        page,
        ({ user: _user, replyToUser: _replyToUser, ...rest }) => rest
      ),
    }),
  ];
}

/** The first page of the top-level comments of a slug, which is still loading. */
function loadingSlug(slug: string): Cached {
  return [
    Ref.getConvexFunctionName(comments.queries.getCommentsBySlug),
    Ref.encodeArgsSync(comments.queries.getCommentsBySlug, {
      paginationOpts: { cursor: null, numItems: 25 },
      slug,
    }),
    undefined,
  ];
}

/** The profile's first page of comments, which is still loading. */
function loadingProfile(): Cached {
  return [
    Ref.getConvexFunctionName(comments.queries.getCommentsByUserId),
    Ref.encodeArgsSync(comments.queries.getCommentsByUserId, {
      paginationOpts: { cursor: null, numItems: 25 },
      userId: AUTHOR,
    }),
    undefined,
  ];
}

/** A page of the replies of a thread after the first one, which is still loading. */
function loadingReplies(threadId: Id<"comments">): Cached {
  return [
    Ref.getConvexFunctionName(comments.queries.getCommentReplies),
    Ref.encodeArgsSync(comments.queries.getCommentReplies, {
      paginationOpts: { cursor: "later", numItems: 25 },
      threadId,
    }),
    undefined,
  ];
}

/**
 * A store with the lists the page has cached. It encodes and decodes with the
 * schemas of the functions, like Confect's own store, and counts the writes.
 */
function fakeStore(initial: readonly Cached[]) {
  const cache = MutableRef.make(initial);
  const writes = MutableRef.make(0);
  const store: OptimisticLocalStore.OptimisticLocalStore = {
    getAllQueries: (ref) =>
      Arr.map(
        Arr.filter(
          MutableRef.get(cache),
          ([name]) => name === Ref.getConvexFunctionName(ref)
        ),
        ([, args, value]) => ({
          args: Ref.decodeArgsSync(ref, args),
          value:
            value === undefined
              ? Option.none()
              : Option.some(Ref.decodeReturnsSync(ref, value)),
        })
      ),
    getQuery: () => Option.none(),
    setQuery: (ref, args, value) => {
      const name = Ref.getConvexFunctionName(ref);
      const encodedArgs = Ref.encodeArgsSync(ref, args);
      const next: Cached = [
        name,
        encodedArgs,
        Option.isSome(value)
          ? Ref.encodeReturnsSync(ref, value.value)
          : undefined,
      ];
      MutableRef.update(writes, (count) => count + 1);
      MutableRef.update(cache, (current) =>
        Arr.some(
          current,
          ([other, otherArgs]) =>
            other === name && Equal.equals(otherArgs, encodedArgs)
        )
          ? Arr.map(current, (entry) =>
              entry[0] === name && Equal.equals(entry[1], encodedArgs)
                ? next
                : entry
            )
          : Arr.append(current, next)
      );
    },
  };
  return { store, writes: () => MutableRef.get(writes) };
}

type Fake = ReturnType<typeof fakeStore>;

/** The ids of the rows on each loaded page of the top-level comments, or none while a page loads. */
function slugPages(fake: Fake) {
  return Arr.map(
    fake.store.getAllQueries(comments.queries.getCommentsBySlug),
    ({ value }) =>
      Option.match(value, {
        onNone: () => null,
        onSome: ({ page }) => Arr.map(page, ({ _id }) => _id),
      })
  );
}

/** The ids of the rows on each loaded page of the replies of a thread. */
function replyPages(fake: Fake) {
  return Arr.map(
    fake.store.getAllQueries(comments.queries.getCommentReplies),
    ({ value }) =>
      Option.match(value, {
        onNone: () => null,
        onSome: ({ page }) => Arr.map(page, ({ _id }) => _id),
      })
  );
}

/** The likes and their counts of the rows on each loaded page of the top-level comments. */
function likesOf(fake: Fake) {
  return Arr.map(
    fake.store.getAllQueries(comments.queries.getCommentsBySlug),
    ({ value }) =>
      Option.match(value, {
        onNone: () => null,
        onSome: ({ page }) =>
          Arr.map(page, ({ liked, likeCount }) => ({ liked, likeCount })),
      })
  );
}

describe("the optimistic changes of the comment lists", () => {
  it("shows a like on the comment in every loaded list, and a second like counts once", () => {
    const fake = fakeStore([
      slugList(null, [row("root"), row("other")]),
      replyList(ROOT, [row("reply", { parentId: ROOT, threadId: ROOT })], true),
      profileList([row("root")]),
      loadingSlug("later"),
    ]);

    likeInLists(fake.store, { commentId: ROOT });
    likeInLists(fake.store, { commentId: ROOT });

    expect(likesOf(fake)).toEqual([
      [
        { liked: true, likeCount: 1 },
        { liked: false, likeCount: 0 },
      ],
      null,
    ]);
    expect(
      Arr.map(
        fake.store.getAllQueries(comments.queries.getCommentsByUserId),
        ({ value }) =>
          Option.getOrUndefined(Option.map(value, ({ page }) => page[0]?.liked))
      )
    ).toEqual([true]);
  });

  it("takes a like off the comment in every loaded list", () => {
    const fake = fakeStore([
      slugList(null, [
        row("root", { liked: true, likeCount: 2, viewerVote: 1 }),
      ]),
    ]);

    unlikeInLists(fake.store, { commentId: ROOT });
    unlikeInLists(fake.store, { commentId: ROOT });

    expect(likesOf(fake)).toEqual([[{ liked: false, likeCount: 1 }]]);
  });

  it("shows a new top-level comment first on the first page of its slug, and writes no other list", () => {
    const draft = row("draft", { _id: commentId("draft") });
    const fake = fakeStore([
      slugList(null, [row("older")]),
      slugList("next", [row("oldest")]),
      slugList(null, [row("elsewhere")], "other-lesson"),
    ]);

    insertDraftComment(draft)(fake.store, { slug: SLUG, text: "draft" });

    expect(slugPages(fake)).toEqual([
      [commentId("draft"), commentId("older")],
      [commentId("oldest")],
      [commentId("elsewhere")],
    ]);
    expect(fake.writes()).toBe(1);
  });

  it("leaves a list that is still loading its first page alone", () => {
    const draft = row("draft", { _id: commentId("draft") });
    const fake = fakeStore([loadingSlug(SLUG)]);

    insertDraftComment(draft)(fake.store, { slug: SLUG, text: "draft" });

    expect(slugPages(fake)).toEqual([null]);
    expect(fake.writes()).toBe(0);
  });

  it("counts a new reply on its top-level comment, and joins the end of the thread that is complete", () => {
    const draft = row("reply", {
      parentId: ROOT,
      threadId: ROOT,
      _id: commentId("reply"),
    });
    const fake = fakeStore([
      slugList(null, [row("root", { replyCount: 1 }), row("other")]),
      replyList(ROOT, [row("first", { parentId: ROOT, threadId: ROOT })], true),
      replyList(OTHER, [row("elsewhere", { threadId: OTHER })], true),
    ]);

    insertDraftReply(draft, ROOT)(fake.store, {
      parentId: ROOT,
      slug: SLUG,
      text: "reply",
    });

    expect(slugPages(fake)).toEqual([[ROOT, OTHER]]);
    expect(
      Arr.map(
        fake.store.getAllQueries(comments.queries.getCommentsBySlug),
        ({ value }) =>
          Option.getOrUndefined(
            Option.map(value, ({ page }) => page[0]?.replyCount)
          )
      )
    ).toEqual([2]);
    expect(replyPages(fake)).toEqual([
      [commentId("first"), commentId("reply")],
      [commentId("elsewhere")],
    ]);
  });

  it("leaves a reply out of a thread whose last page is not loaded yet", () => {
    const draft = row("reply", { _id: commentId("reply"), threadId: ROOT });
    const fake = fakeStore([
      replyList(ROOT, [row("first", { threadId: ROOT })], false),
    ]);

    insertDraftReply(draft, ROOT)(fake.store, {
      parentId: ROOT,
      slug: SLUG,
      text: "reply",
    });

    expect(replyPages(fake)).toEqual([[commentId("first")]]);
  });

  it("takes a top-level comment off every loaded list, with the replies that are not shown", () => {
    const fake = fakeStore([
      slugList(null, [row("root"), row("other")]),
      profileList([row("root"), row("own")]),
      replyList(ROOT, [row("reply", { threadId: ROOT })], true),
    ]);

    removeFromLists(fake.store, { commentId: ROOT });

    expect(slugPages(fake)).toEqual([[OTHER]]);
    expect(
      Arr.map(
        fake.store.getAllQueries(comments.queries.getCommentsByUserId),
        ({ value }) =>
          Option.getOrUndefined(
            Option.map(value, ({ page }) => Arr.map(page, (row) => row._id))
          )
      )
    ).toEqual([[commentId("own")]]);
  });

  it("takes a reply and the replies below it off its thread, and lowers the reply count of the top-level comment by their number", () => {
    const first = row("first", { parentId: ROOT, threadId: ROOT });
    const nested = row("nested", {
      parentId: commentId("first"),
      threadId: ROOT,
    });
    const sibling = row("sibling", { parentId: ROOT, threadId: ROOT });
    const fake = fakeStore([
      slugList(null, [row("root", { replyCount: 3 })]),
      replyList(ROOT, [first, nested, sibling], true),
    ]);

    removeFromLists(fake.store, { commentId: first._id });

    expect(replyPages(fake)).toEqual([[commentId("sibling")]]);
    expect(
      Arr.map(
        fake.store.getAllQueries(comments.queries.getCommentsBySlug),
        ({ value }) =>
          Option.getOrUndefined(
            Option.map(value, ({ page }) => page[0]?.replyCount)
          )
      )
    ).toEqual([1]);
  });

  it("finds a reply past a list of another thread and a list that is still loading", () => {
    const nested = row("nested", {
      parentId: commentId("first"),
      threadId: ROOT,
    });
    const fake = fakeStore([
      slugList(null, [row("root", { replyCount: 2 })]),
      loadingSlug("later"),
      loadingProfile(),
      replyList(OTHER, [row("elsewhere", { threadId: OTHER })], true),
      loadingReplies(ROOT),
      replyList(
        ROOT,
        [row("first", { parentId: ROOT, threadId: ROOT }), nested],
        true
      ),
    ]);

    removeFromLists(fake.store, { commentId: nested._id });

    expect(replyPages(fake)).toEqual([
      [commentId("elsewhere")],
      null,
      [commentId("first")],
    ]);
    expect(
      Arr.map(
        fake.store.getAllQueries(comments.queries.getCommentsBySlug),
        ({ value }) =>
          Option.getOrUndefined(
            Option.map(value, ({ page }) => page[0]?.replyCount)
          )
      )
    ).toEqual([1, undefined]);
  });

  it("changes nothing when no loaded list holds the comment", () => {
    const fake = fakeStore([slugList(null, [row("root")])]);

    removeFromLists(fake.store, { commentId: commentId("missing") });

    expect(slugPages(fake)).toEqual([[ROOT]]);
    expect(fake.writes()).toBe(0);
  });
});
