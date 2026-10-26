import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Option, Schema } from "effect";
import {
  type ClassPost,
  editPostUpdate,
  publishUpdate,
  removePostUpdate,
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
  const setQuery = vi.fn();
  return {
    localStore: {
      getAllQueries: vi.fn(() => pages),
      getQuery: vi.fn(),
      setQuery,
    },
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
});
