import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Option, Schema } from "effect";
import {
  type ClassPost,
  editPostUpdate,
  pinPostUpdate,
  publishUpdate,
  removePostUpdate,
  votePostUpdate,
} from "@/components/tenant/classes/home/optimistic";

const slug = Schema.decodeSync(TenantSlug)("sekolah");
const classOf = Schema.decodeUnknownSync(Id("classes"));
const postOf = Schema.decodeUnknownSync(Id("classroomPosts"));
const classId = classOf("class-1");
const otherClass = classOf("class-2");
const personId = Schema.decodeUnknownSync(Id("tenantPeople"))("person-1");

/** An announcement of the class, posted by the viewer. */
const post = (id: string, text: string): ClassPost => ({
  author: { id: personId, name: "Bu Rina" },
  clientKey: `key-${id}-0000`,
  createdAt: 1,
  editedAt: null,
  email: false,
  id: postOf(id),
  mine: true,
  pinned: false,
  poll: null,
  text,
});

/** The arguments of one page of a class's announcements. */
const listArgs = (forClass: typeof classId, cursor: string | null) => ({
  classId: forClass,
  paginationOpts: { cursor, numItems: 20 },
  slug,
});

/** A store that holds the given pages, and records what is written. */
const storeOf = (pages: unknown[]) => {
  const getAllQueries = vi.fn();
  getAllQueries.mockReturnValue(pages);
  const setQuery = vi.fn();
  return {
    localStore: { getAllQueries, getQuery: vi.fn(), setQuery },
    setQuery,
  };
};

const first = post("first", "Ulangan hari Senin.");
const second = post("second", "Bawa kalkulator.");
const third = post("third", "Pakai seragam olahraga.");
const pages = [
  {
    args: listArgs(classId, null),
    value: Option.some({ isDone: false, page: [first] }),
  },
  {
    args: listArgs(classId, "older"),
    value: Option.some({ isDone: true, page: [second, third] }),
  },
  {
    args: listArgs(otherClass, null),
    value: Option.some({ isDone: true, page: [] }),
  },
  { args: listArgs(classId, null), value: Option.none() },
];

describe("class home optimistic updates", () => {
  it("shows a posted announcement first in the class's newest page only", () => {
    const sent = post("sent", "Libur hari Jumat.");
    const { localStore, setQuery } = storeOf(pages);

    publishUpdate(sent)(localStore, {
      classId,
      clientKey: sent.clientKey,
      email: false,
      poll: null,
      slug,
      text: sent.text,
    });

    expect(setQuery.mock.calls).toEqual([
      [
        classroom.posts.list,
        listArgs(classId, null),
        Option.some({ isDone: false, page: [sent, first] }),
      ],
    ]);
  });

  it("changes and removes one announcement in the page that holds it", () => {
    const edited = storeOf(pages);
    editPostUpdate(5000)(edited.localStore, {
      classId,
      postId: second.id,
      slug,
      text: "Bawa penggaris.",
    });
    expect(edited.setQuery.mock.calls).toEqual([
      [
        classroom.posts.list,
        listArgs(classId, "older"),
        Option.some({
          isDone: true,
          page: [{ ...second, editedAt: 5000, text: "Bawa penggaris." }, third],
        }),
      ],
    ]);

    const removed = storeOf(pages);
    removePostUpdate(removed.localStore, {
      classId,
      postId: first.id,
      slug,
    });
    expect(removed.setQuery.mock.calls).toEqual([
      [
        classroom.posts.list,
        listArgs(classId, null),
        Option.some({ isDone: false, page: [] }),
      ],
    ]);
  });

  it("shows a pinned announcement on its page and first at the top of the home, and takes it down again", () => {
    const pinnedArgs = { classId, slug };
    const held = post("held", "Sudah disematkan.");
    const pinnedQueries = [
      { args: pinnedArgs, value: Option.some([{ ...held, pinned: true }]) },
      { args: { classId: otherClass, slug }, value: Option.some([]) },
      { args: pinnedArgs, value: Option.none() },
    ];
    /** The store of the home, which answers the pages and the pinned announcements by the query it is asked for. */
    const homeStore = () => {
      const store = storeOf(pages);
      store.localStore.getAllQueries.mockImplementation((query) =>
        query === classroom.posts.pinned ? pinnedQueries : pages
      );
      return store;
    };
    const pinning = homeStore();
    pinPostUpdate(first)(pinning.localStore, {
      classId,
      pinned: true,
      postId: first.id,
      slug,
    });
    expect(Arr.last(pinning.setQuery.mock.calls)).toEqual(
      Option.some([
        classroom.posts.pinned,
        pinnedArgs,
        Option.some([
          { ...first, pinned: true },
          { ...held, pinned: true },
        ]),
      ])
    );

    const unpinning = homeStore();
    pinPostUpdate(held)(unpinning.localStore, {
      classId,
      pinned: false,
      postId: held.id,
      slug,
    });
    expect(Arr.last(unpinning.setQuery.mock.calls)).toEqual(
      Option.some([classroom.posts.pinned, pinnedArgs, Option.some([])])
    );
  });

  it("shows the viewer's choice in a poll at once, in the reads that hold its post", () => {
    const voted = (postId: typeof first.id) => ({
      classId,
      postIds: [postId],
      slug,
    });
    const { localStore, setQuery } = storeOf([
      {
        args: voted(first.id),
        value: Option.some([
          {
            postId: first.id,
            votes: [{ count: 1, mine: true, option: 0 }],
          },
        ]),
      },
      { args: voted(second.id), value: Option.some([]) },
      { args: voted(first.id), value: Option.none() },
    ]);
    votePostUpdate(localStore, {
      classId,
      options: [1],
      postId: first.id,
      slug,
    });
    expect(setQuery.mock.calls).toEqual([
      [
        classroom.posts.votes,
        voted(first.id),
        Option.some([
          {
            postId: first.id,
            votes: [{ count: 1, mine: true, option: 1 }],
          },
        ]),
      ],
    ]);
    const empty = storeOf([{ args: voted(first.id), value: Option.some([]) }]);
    votePostUpdate(empty.localStore, {
      classId,
      options: [0],
      postId: first.id,
      slug,
    });
    expect(empty.setQuery.mock.calls[0]?.[2]).toEqual(
      Option.some([
        { postId: first.id, votes: [{ count: 1, mine: true, option: 0 }] },
      ])
    );
  });
});
