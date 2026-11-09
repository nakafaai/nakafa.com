import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import comments from "@repo/backend/confect/_generated/refs/comments";
import { MASCOT } from "@repo/backend/test/mascot";
import { Array as Arr, Option, Schema } from "effect";
import {
  editInLists,
  insertDraftComment,
  insertDraftReply,
  likeInLists,
  removeFromLists,
  unlikeInLists,
} from "@/components/comments/mutation";
import type { CommentRow } from "@/components/comments/state";
import { createLocalStore } from "@/test/optimistic";

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
    likeCount: 0,
    liked: false,
    photos: [],
    replyCount: 0,
    replyToUser: null,
    slug: SLUG,
    text: id,
    user: { _id: AUTHOR, mascot: MASCOT, name: "Author" },
    userId: AUTHOR,
    ...change,
  };
}

/** One query the page has cached, seeded into the store as the server sent it. */
type Cached = (local: ReturnType<typeof createLocalStore>) => void;

/** A page of the top-level comments of a slug. */
const slugList =
  (
    cursor: string | null,
    page: CommentRow[],
    slug = SLUG,
    isDone = false
  ): Cached =>
  (local) =>
    local.seed(
      comments.queries.getCommentsBySlug,
      { paginationOpts: { cursor, numItems: 25 }, slug, sort: "newest" },
      { continueCursor: "next", isDone, page }
    );

/** A page of the replies of a thread. */
const replyList =
  (threadId: Id<"comments">, page: CommentRow[], isDone: boolean): Cached =>
  (local) =>
    local.seed(
      comments.queries.getCommentReplies,
      { paginationOpts: { cursor: null, numItems: 25 }, threadId },
      { continueCursor: "next", isDone, page }
    );

/** The profile's comments, which carry no author of their own. */
const profileList =
  (page: CommentRow[]): Cached =>
  (local) =>
    local.seed(
      comments.queries.getCommentsByUserId,
      { paginationOpts: { cursor: null, numItems: 25 }, userId: AUTHOR },
      {
        continueCursor: "next",
        isDone: true,
        page: Arr.map(
          page,
          ({ user: _user, replyToUser: _replyToUser, ...rest }) => rest
        ),
      }
    );

/** The count of a slug's comments, or none while it loads. */
const countOf =
  (slug: string, count: number | undefined): Cached =>
  (local) =>
    local.seed(comments.queries.getCommentCount, { slug }, count);

/** The first page of the top-level comments of a slug, which is still loading. */
const loadingSlug =
  (slug: string): Cached =>
  (local) =>
    local.seed(
      comments.queries.getCommentsBySlug,
      { paginationOpts: { cursor: null, numItems: 25 }, slug, sort: "newest" },
      undefined
    );

/** The profile's first page of comments, which is still loading. */
const loadingProfile = (): Cached => (local) =>
  local.seed(
    comments.queries.getCommentsByUserId,
    { paginationOpts: { cursor: null, numItems: 25 }, userId: AUTHOR },
    undefined
  );

/** A page of the replies of a thread after the first one, which is still loading. */
const loadingReplies =
  (threadId: Id<"comments">): Cached =>
  (local) =>
    local.seed(
      comments.queries.getCommentReplies,
      { paginationOpts: { cursor: "later", numItems: 25 }, threadId },
      undefined
    );

/** The shared local store with the lists the page has cached, which counts the writes. */
function fakeStore(initial: readonly Cached[]) {
  const local = createLocalStore();
  Arr.forEach(initial, (seed) => seed(local));
  return { store: local.store, writes: () => local.written().length };
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
      slugList(null, [row("root", { liked: true, likeCount: 2 })]),
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

    insertDraftComment(draft)(fake.store, {
      slug: SLUG,
      text: "draft",
      uploads: [],
    });

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

    insertDraftComment(draft)(fake.store, {
      slug: SLUG,
      text: "draft",
      uploads: [],
    });

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
      uploads: [],
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
      uploads: [],
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

  it("moves a slug's count with a new comment, a reply and a deletion, never below zero, and leaves other counts alone", () => {
    const fake = fakeStore([
      countOf(SLUG, 3),
      countOf("other-lesson", 9),
      countOf("later", undefined),
      slugList(null, [row("root", { replyCount: 1 })]),
      replyList(ROOT, [row("first", { parentId: ROOT, threadId: ROOT })], true),
    ]);
    const counts = () =>
      Arr.map(
        fake.store.getAllQueries(comments.queries.getCommentCount),
        ({ value }) => Option.getOrUndefined(value)
      );
    const post = { slug: SLUG, text: "new", uploads: [] };

    insertDraftComment(row("draft"))(fake.store, post);
    insertDraftReply(row("reply", { threadId: ROOT }), ROOT)(fake.store, post);
    expect(counts()).toEqual([5, 9, undefined]);
    removeFromLists(fake.store, { commentId: commentId("first") });
    expect(counts()).toEqual([4, 9, undefined]);
    removeFromLists(fake.store, { commentId: ROOT });
    expect(counts()).toEqual([2, 9, undefined]);
    removeFromLists(fake.store, { commentId: commentId("draft") });
    removeFromLists(fake.store, { commentId: commentId("draft") });
    expect(counts()).toEqual([1, 9, undefined]);
    const empty = fakeStore([countOf(SLUG, 0), slugList(null, [row("root")])]);
    removeFromLists(empty.store, { commentId: ROOT });
    expect(
      Arr.map(
        empty.store.getAllQueries(comments.queries.getCommentCount),
        ({ value }) => Option.getOrUndefined(value)
      )
    ).toEqual([0]);
  });

  it("shows a comment's new text, marked edited, in every loaded list", () => {
    const fake = fakeStore([
      slugList(null, [row("root"), row("other")]),
      profileList([row("root")]),
    ]);

    editInLists(42)(fake.store, { commentId: ROOT, text: "Baru" });

    const shown = Arr.flatMap(
      [
        ...fake.store.getAllQueries(comments.queries.getCommentsBySlug),
        ...fake.store.getAllQueries(comments.queries.getCommentsByUserId),
      ],
      ({ value }) =>
        Option.isSome(value)
          ? Arr.map(value.value.page, ({ editedAt, text }) => [text, editedAt])
          : []
    );
    expect(shown).toEqual([
      ["Baru", 42],
      ["other", undefined],
      ["Baru", 42],
    ]);
  });
});
