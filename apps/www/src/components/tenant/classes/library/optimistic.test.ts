import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Option, Schema } from "effect";
import {
  addLinkUpdate,
  type LibraryItem,
  removeItemUpdate,
} from "@/components/tenant/classes/library/optimistic";

const slug = Schema.decodeSync(TenantSlug)("sekolah");
const classOf = Schema.decodeUnknownSync(Id("classes"));
const itemOf = Schema.decodeUnknownSync(Id("classroomLibrary"));
const classId = classOf("class-1");
const otherClass = classOf("class-2");

/** A link of the class library. */
const link = (id: string, title: string): LibraryItem => ({
  address: `https://example.com/${id}`,
  author: "Bu Rina",
  byteSize: null,
  clientKey: `key-${id}-0000`,
  createdAt: 1,
  id: itemOf(id),
  kind: "link",
  title,
});

/** The arguments of one page of a class's library. */
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

const first = link("first", "Video gerak lurus");
const second = link("second", "Materi Nakafa");
const pages = [
  {
    args: listArgs(classId, null),
    value: Option.some({ isDone: false, page: [first] }),
  },
  {
    args: listArgs(classId, "older"),
    value: Option.some({ isDone: true, page: [second] }),
  },
  {
    args: listArgs(otherClass, null),
    value: Option.some({ isDone: true, page: [] }),
  },
  { args: listArgs(classId, null), value: Option.none() },
];

describe("class library optimistic updates", () => {
  it("shows an added link first in the class's newest page only", () => {
    const sent = link("sent", "Simulasi PhET");
    const { localStore, setQuery } = storeOf(pages);
    addLinkUpdate(sent)(localStore, {
      address: sent.address ?? "",
      classId,
      clientKey: sent.clientKey,
      slug,
      title: sent.title,
    });
    expect(setQuery.mock.calls).toEqual([
      [
        classroom.library.list,
        listArgs(classId, null),
        Option.some({ isDone: false, page: [sent, first] }),
      ],
    ]);
  });

  it("removes one item from the page that holds it", () => {
    const { localStore, setQuery } = storeOf(pages);
    removeItemUpdate(localStore, { classId, itemId: second.id, slug });
    expect(setQuery.mock.calls).toEqual([
      [
        classroom.library.list,
        listArgs(classId, "older"),
        Option.some({ isDone: true, page: [] }),
      ],
    ]);
  });
});
