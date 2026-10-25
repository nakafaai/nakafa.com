import { Ref } from "@confect/core";
import type * as OptimisticLocalStore from "@confect/react/OptimisticLocalStore";
import { describe, expect, it } from "@effect/vitest";
import { POST_PAGE_SIZE } from "@repo/backend/client/posts/list";
import { Id } from "@repo/backend/confect/_generated/id";
import posts from "@repo/backend/confect/_generated/refs/posts";
import { Array as Arr, Equal, MutableRef, Option, Schema } from "effect";
import {
  changeLists,
  insertDraftPost,
  likeInLists,
  removeFromLists,
  unlikeInLists,
} from "@/components/user/posts/mutation";
import {
  type ListPost,
  likePost,
  updatePost,
} from "@/components/user/posts/state";

const postId = Schema.decodeUnknownSync(Id("posts"));
const AUTHOR = Schema.decodeUnknownSync(Id("users"))("author");

/** A post row with the given id, as the server sends it. */
function post(id: string, change: Partial<ListPost> = {}): ListPost {
  return {
    _creationTime: 1,
    _id: postId(id),
    likeCount: 0,
    liked: false,
    text: id,
    ...change,
  };
}

/**
 * One query the fake store holds: the name of its function, its encoded
 * arguments, and its encoded answer, which is none while the query loads.
 */
type Cached = readonly [name: string, args: unknown, value: unknown];

/** A page of the posts of the author, held as Convex holds it. */
function listed(
  cursor: string | null,
  page: ListPost[],
  isDone = false
): Cached {
  return [
    Ref.getConvexFunctionName(posts.queries.list),
    Ref.encodeArgsSync(posts.queries.list, {
      authorId: AUTHOR,
      paginationOpts: { cursor, numItems: POST_PAGE_SIZE },
    }),
    Ref.encodeReturnsSync(posts.queries.list, {
      continueCursor: "next",
      isDone,
      page,
    }),
  ];
}

/** A page of the posts of the author that is still loading. */
function loading(cursor: string | null): Cached {
  return [
    Ref.getConvexFunctionName(posts.queries.list),
    Ref.encodeArgsSync(posts.queries.list, {
      authorId: AUTHOR,
      paginationOpts: { cursor, numItems: POST_PAGE_SIZE },
    }),
    undefined,
  ];
}

/**
 * A store with the lists the page has cached. It encodes and decodes with the
 * schemas of the functions, like Confect's own store over Convex's, and counts
 * the queries written, because a write wakes everything that reads the query.
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
    // The change reads the lists through `getAllQueries`, never one query.
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

const ids = (page: readonly ListPost[]) => Arr.map(page, ({ _id }) => _id);

/** The pages the fake store holds, as the ids of their posts, or none while one loads. */
function pagesOf(fake: Fake) {
  return Arr.map(fake.store.getAllQueries(posts.queries.list), ({ value }) =>
    Option.match(value, {
      onNone: () => null,
      onSome: ({ page }) => ids(page),
    })
  );
}

/** The pages the fake store holds, as whether each of their posts is liked, or none while one loads. */
function likedOf(fake: Fake) {
  return Arr.map(fake.store.getAllQueries(posts.queries.list), ({ value }) =>
    Option.match(value, {
      onNone: () => null,
      onSome: ({ page }) => Arr.map(page, ({ liked }) => liked),
    })
  );
}

describe("the optimistic changes of the posts list", () => {
  const older = post("older");
  const newer = post("newer");
  const draft = post("draft", { text: "Hari ini belajar." });

  it("shows the draft first on the page that starts the list, and writes no other page", () => {
    const fake = fakeStore([listed(null, [older]), listed("next", [newer])]);

    insertDraftPost(draft)(fake.store, { text: draft.text });

    expect(pagesOf(fake)).toEqual([[draft._id, older._id], [newer._id]]);
    expect(fake.writes()).toBe(1);
  });

  it("leaves a list that is still loading its first page alone", () => {
    const fake = fakeStore([loading(null)]);

    insertDraftPost(draft)(fake.store, { text: draft.text });

    expect(pagesOf(fake)).toEqual([null]);
    expect(fake.writes()).toBe(0);
  });

  it("changes the post on every loaded page, and leaves a loading list alone", () => {
    const fake = fakeStore([
      listed(null, [older]),
      listed("next", [newer]),
      loading("later"),
    ]);

    changeLists(fake.store, (page) => updatePost(page, newer._id, likePost));

    expect(likedOf(fake)).toEqual([[false], [true], null]);
    expect(fake.writes()).toBe(2);
  });

  it("shows a like, then its removal, and then the removal of the post, on every loaded page", () => {
    const fake = fakeStore([
      listed(null, [older]),
      listed("next", [newer]),
      loading("later"),
    ]);

    likeInLists(fake.store, { postId: newer._id });
    expect(likedOf(fake)).toEqual([[false], [true], null]);

    unlikeInLists(fake.store, { postId: newer._id });
    expect(likedOf(fake)).toEqual([[false], [false], null]);

    removeFromLists(fake.store, { postId: newer._id });
    expect(pagesOf(fake)).toEqual([[older._id], [], null]);
  });
});
