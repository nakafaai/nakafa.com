import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Option, Result, Schema } from "effect";
import {
  addFolderUpdate,
  addLibraryFolder,
  childFolders,
  folderPath,
  isSavedFolder,
  isWithin,
  type LibraryFolder,
  moveFolderUpdate,
  purgeFolderUpdate,
  renameFolderUpdate,
  restoreFolderUpdate,
  starFolderUpdate,
  trashFolderUpdate,
} from "@/components/tenant/classes/library/folder";

const slug = Schema.decodeSync(TenantSlug)("sekolah");
const classOf = Schema.decodeUnknownSync(Id("classes"));
const folderOf = Schema.decodeUnknownSync(Id("classroomFolders"));
const classId = classOf("class-1");
const otherClass = classOf("class-2");

/** A folder of the class library. */
const folder = (
  id: string,
  name: string,
  parentId: LibraryFolder["parentId"] = null
): LibraryFolder => ({
  author: "Bu Rina",
  clientKey: `key-${id}-0000`,
  createdAt: 1,
  id: folderOf(id),
  name,
  parentId,
  starred: false,
  trashedAt: null,
});

const first = folder("first", "Bab 1");
const second = folder("second", "Bab 2");

/** The folders of two classes, and a read that has not arrived, in a store that records what is written. */
const storeOf = () => {
  const getAllQueries = vi.fn();
  getAllQueries.mockReturnValue([
    { args: { classId, slug }, value: Option.some([first, second]) },
    { args: { classId: otherClass, slug }, value: Option.some([]) },
    { args: { classId, slug }, value: Option.none() },
  ]);
  const setQuery = vi.fn();
  return {
    localStore: { getAllQueries, getQuery: vi.fn(), setQuery },
    setQuery,
  };
};

describe("class library folders", () => {
  it("tells a folder the server keeps from one that holds its client key", () => {
    expect(isSavedFolder(first)).toBe(true);
    expect(isSavedFolder({ ...first, id: folderOf(first.clientKey) })).toBe(
      false
    );
  });

  it("shows an added folder last, a new name, and a removal at once, in the class's folders only", () => {
    const added = folder("added", "Bab 3");
    const adding = storeOf();
    addFolderUpdate(added)(adding.localStore, {
      classId,
      clientKey: added.clientKey,
      name: added.name,
      parentId: null,
      slug,
    });
    expect(adding.setQuery.mock.calls).toEqual([
      [
        classroom.folders.list,
        { classId, slug },
        Option.some([first, second, added]),
      ],
    ]);

    const renaming = storeOf();
    renameFolderUpdate(renaming.localStore, {
      classId,
      folderId: first.id,
      name: "Gerak lurus",
      slug,
    });
    expect(renaming.setQuery.mock.calls).toEqual([
      [
        classroom.folders.list,
        { classId, slug },
        Option.some([{ ...first, name: "Gerak lurus" }, second]),
      ],
    ]);

    const removing = storeOf();
    purgeFolderUpdate(removing.localStore, {
      classId,
      folderId: first.id,
      slug,
    });
    expect(removing.setQuery.mock.calls).toEqual([
      [classroom.folders.list, { classId, slug }, Option.some([second])],
    ]);
  });

  it.effect(
    "adds a folder under its client key, and shows it before the server answers",
    () =>
      Effect.gen(function* () {
        const args = {
          classId,
          clientKey: "key-added-0000",
          name: "Bab 3",
          parentId: null,
          slug,
        };
        const add = vi.fn((_update: unknown, _args: unknown) =>
          Promise.resolve(Result.succeed(first))
        );
        expect(yield* addLibraryFolder(add, "Bu Rina", args)).toEqual(first);
        expect(add).toHaveBeenCalledWith(expect.any(Function), args);
        const { localStore, setQuery } = storeOf();
        const update = add.mock.calls[0]?.[0];
        if (typeof update === "function") {
          update(localStore, args);
        }
        expect(setQuery.mock.calls[0]?.[2]).toEqual(
          Option.some([
            first,
            second,
            {
              author: "Bu Rina",
              clientKey: args.clientKey,
              createdAt: 0,
              id: folderOf(args.clientKey),
              name: "Bab 3",
              parentId: null,
              starred: false,
              trashedAt: null,
            },
          ])
        );
      })
  );

  it("moves, trashes, restores and stars a folder at once, and ignores an item's star", () => {
    const written = (
      run: (store: ReturnType<typeof storeOf>["localStore"]) => void
    ) => {
      const store = storeOf();
      run(store.localStore);
      return store.setQuery.mock.calls[0]?.[2];
    };
    expect(
      written((store) =>
        moveFolderUpdate(store, {
          classId,
          folderId: second.id,
          parentId: first.id,
          slug,
        })
      )
    ).toEqual(Option.some([first, { ...second, parentId: first.id }]));
    expect(
      written((store) =>
        trashFolderUpdate(5)(store, { classId, folderId: first.id, slug })
      )
    ).toEqual(Option.some([{ ...first, trashedAt: 5 }, second]));
    expect(
      written((store) =>
        restoreFolderUpdate(store, { classId, folderId: first.id, slug })
      )
    ).toEqual(Option.some([first, second]));
    expect(
      written((store) =>
        starFolderUpdate(store, {
          classId,
          slug,
          starred: true,
          target: { folderId: first.id, kind: "folder" },
        })
      )
    ).toEqual(Option.some([{ ...first, starred: true }, second]));
    expect(
      written((store) =>
        starFolderUpdate(store, {
          classId,
          slug,
          starred: true,
          target: {
            itemId: Schema.decodeUnknownSync(Id("classroomLibrary"))("item"),
            kind: "item",
          },
        })
      )
    ).toBeUndefined();
  });

  it("finds a folder's children, its path from the top, and whether it sits inside another", () => {
    const child = folder("child", "Sub", first.id);
    const trashed = { ...folder("gone", "Lama", first.id), trashedAt: 3 };
    const loop = folder("loop", "Lingkar", folderOf("loop"));
    const folders = [first, second, child, trashed, loop];
    expect(childFolders(folders, first.id)).toEqual([child]);
    expect(folderPath(folders, child.id)).toEqual([first, child]);
    expect(folderPath(folders, null)).toEqual([]);
    expect(folderPath(folders, folderOf("missing"))).toEqual([]);
    expect(folderPath(folders, loop.id)).toHaveLength(folders.length);
    expect(isWithin(folders, child.id, first.id)).toBe(true);
    expect(isWithin(folders, second.id, first.id)).toBe(false);
  });
});
