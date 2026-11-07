import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Option, Schema } from "effect";
import {
  addLinkUpdate,
  editItemUpdate,
  type LibraryItem,
  moveItemUpdate,
  purgeItemUpdate,
  restoreItemUpdate,
  starItemUpdate,
  trashItemUpdate,
} from "@/components/tenant/classes/library/optimistic";

const slug = Schema.decodeSync(TenantSlug)("sekolah");
const classOf = Schema.decodeUnknownSync(Id("classes"));
const itemOf = Schema.decodeUnknownSync(Id("classroomLibrary"));
const folderOf = Schema.decodeUnknownSync(Id("classroomFolders"));
const classId = classOf("class-1");
const otherClass = classOf("class-2");

/** A link of the class library. */
const link = (id: string, title: string): LibraryItem => ({
  address: `https://example.com/${id}`,
  author: "Bu Rina",
  byteSize: null,
  clientKey: `key-${id}-0000`,
  createdAt: 1,
  folderId: null,
  id: itemOf(id),
  kind: "link",
  starred: false,
  title,
  trashedAt: null,
});

/** The arguments of one page of a class's library. */
const listArgs = (
  forClass: typeof classId,
  cursor: string | null,
  folderId: LibraryItem["folderId"] = null
) => ({
  classId: forClass,
  folderId,
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
      folderId: null,
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

  it("takes an item moved to the trash out of the page that holds it", () => {
    const { localStore, setQuery } = storeOf(pages);
    trashItemUpdate(localStore, { classId, itemId: second.id, slug });
    expect(setQuery.mock.calls).toEqual([
      [
        classroom.library.list,
        listArgs(classId, "older"),
        Option.some({ isDone: true, page: [] }),
      ],
    ]);
  });

  it("shows an item's new title and address in the page that holds it, and keeps an address none replaces", () => {
    const { localStore, setQuery } = storeOf(pages);
    editItemUpdate(localStore, {
      address: "https://example.com/baru",
      classId,
      folderId: null,
      itemId: first.id,
      slug,
      title: "Video baru",
    });
    editItemUpdate(localStore, {
      address: null,
      classId,
      folderId: null,
      itemId: second.id,
      slug,
      title: "Materi baru",
    });
    expect(setQuery.mock.calls).toEqual([
      [
        classroom.library.list,
        listArgs(classId, null),
        Option.some({
          isDone: false,
          page: [
            {
              ...first,
              address: "https://example.com/baru",
              title: "Video baru",
            },
          ],
        }),
      ],
      [
        classroom.library.list,
        listArgs(classId, "older"),
        Option.some({ isDone: true, page: [second] }),
      ],
      [
        classroom.library.list,
        listArgs(classId, null),
        Option.some({ isDone: false, page: [first] }),
      ],
      [
        classroom.library.list,
        listArgs(classId, "older"),
        Option.some({
          isDone: true,
          page: [{ ...second, title: "Materi baru" }],
        }),
      ],
    ]);
  });

  it("takes an item moved to a folder out of the pages of the place it left, and shows a link in its own folder", () => {
    const folderId = folderOf("folder-1");
    const held = link("held", "Di folder");
    const { localStore, setQuery } = storeOf([
      {
        args: listArgs(classId, null),
        value: Option.some({ isDone: true, page: [first] }),
      },
      {
        args: listArgs(classId, null, folderId),
        value: Option.some({ isDone: true, page: [held] }),
      },
    ]);
    editItemUpdate(localStore, {
      address: null,
      classId,
      folderId,
      itemId: first.id,
      slug,
      title: first.title,
    });
    addLinkUpdate({ ...first, folderId })(localStore, {
      address: first.address ?? "",
      classId,
      clientKey: first.clientKey,
      folderId,
      slug,
      title: first.title,
    });
    expect(setQuery.mock.calls).toEqual([
      [
        classroom.library.list,
        listArgs(classId, null),
        Option.some({ isDone: true, page: [] }),
      ],
      [
        classroom.library.list,
        listArgs(classId, null, folderId),
        Option.some({ isDone: true, page: [held] }),
      ],
      [
        classroom.library.list,
        listArgs(classId, null, folderId),
        Option.some({ isDone: true, page: [{ ...first, folderId }, held] }),
      ],
    ]);
  });

  it("takes a moved item out of the folder it left and leaves the folder it joins to the server", () => {
    const folderId = folderOf("folder-1");
    const { localStore, setQuery } = storeOf([
      ...pages,
      {
        args: listArgs(classId, null, folderId),
        value: Option.some({ isDone: true, page: [] }),
      },
    ]);
    moveItemUpdate(localStore, { classId, folderId, itemId: first.id, slug });
    expect(setQuery.mock.calls).toEqual([
      [
        classroom.library.list,
        listArgs(classId, null),
        Option.some({ isDone: false, page: [] }),
      ],
    ]);
  });

  it("shows an item's star at once and ignores a folder's", () => {
    const { localStore, setQuery } = storeOf(pages);
    starItemUpdate(localStore, {
      classId,
      slug,
      starred: true,
      target: { itemId: first.id, kind: "item" },
    });
    starItemUpdate(localStore, {
      classId,
      slug,
      starred: true,
      target: { folderId: folderOf("folder-1"), kind: "folder" },
    });
    expect(setQuery.mock.calls[0]).toEqual([
      classroom.library.list,
      listArgs(classId, null),
      Option.some({ isDone: false, page: [{ ...first, starred: true }] }),
    ]);
    expect(setQuery.mock.calls).toHaveLength(3);
  });

  it("takes a restored and a purged item out of the trash at once", () => {
    const trashArgs = (forClass: typeof classId) => ({
      classId: forClass,
      paginationOpts: { cursor: null, numItems: 20 },
      slug,
    });
    const { localStore, setQuery } = storeOf([
      {
        args: trashArgs(classId),
        value: Option.some({ isDone: true, page: [first, second] }),
      },
      {
        args: trashArgs(otherClass),
        value: Option.some({ isDone: true, page: [] }),
      },
      { args: trashArgs(classId), value: Option.none() },
    ]);
    restoreItemUpdate(localStore, { classId, itemId: first.id, slug });
    purgeItemUpdate(localStore, { classId, itemId: second.id, slug });
    expect(setQuery.mock.calls).toEqual([
      [
        classroom.library.trashed,
        trashArgs(classId),
        Option.some({ isDone: true, page: [second] }),
      ],
      [
        classroom.library.trashed,
        trashArgs(classId),
        Option.some({ isDone: true, page: [first] }),
      ],
    ]);
  });
});
