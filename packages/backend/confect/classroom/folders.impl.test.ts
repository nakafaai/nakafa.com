import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { FOLDER_LIMIT } from "@repo/backend/confect/classroom/library/folder";
import { makeBucket, stubBucket } from "@repo/backend/test/bucket";
import {
  denied,
  firstPage,
  forumClass,
  keyedFixture,
  nf,
  period,
} from "@repo/backend/test/classroom";
import { addFile, PDF } from "@repo/backend/test/library";
import { TENANCY_NOW } from "@repo/backend/test/tenancy";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect, Struct } from "effect";

const { folders, library } = refs.public.classroom;

/** A class taught by the fixture's teacher with the fixture's student placed in it. */
const libraryClass = Effect.fn("test.folders.class")(function* () {
  const fixture = yield* keyedFixture;
  const term = yield* period(fixture, fixture.units.smp);
  const forum = yield* forumClass(fixture, term.id, "X-1");
  return { classId: forum.classId, fixture, term };
});

/** Every folder the server stored, so a test reads the sealed rows. */
const folderRows = Effect.flatMap(DatabaseReader, (reader) =>
  reader.table("classroomFolders").index("by_creation_time").take(100)
);

/** The fetch that R2 answers, stubbed once for the file. */
const fetcher = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetcher);
const bucket = makeBucket();

describe("classroom/folders", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
    bucket.state.objects = {};
    fetcher.mockImplementation((input, init) => bucket.answer(input, init));
    stubBucket();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.effect(
    "adds a folder under its seal once for a client key, renames it, and shows it to whoever reads the library",
    () =>
      Effect.gen(function* () {
        const { classId, fixture } = yield* libraryClass();
        const teacher = fixture.as("teacher");
        const args = {
          classId,
          clientKey: "folder-1",
          name: "Bab 1",
          parentId: null,
          slug: nf,
        };
        const added = yield* teacher.mutation(folders.add, args);
        expect(added).toMatchObject({
          author: "Teacher",
          name: "Bab 1",
        });
        expect(yield* teacher.mutation(folders.add, args)).toEqual(added);
        expect(yield* fixture.run(folderRows)).toHaveLength(1);
        expect(encodeJsonText(yield* fixture.run(folderRows))).not.toContain(
          "Bab 1"
        );

        expect(
          yield* teacher.mutation(folders.rename, {
            classId,
            folderId: added.id,
            name: "Gerak lurus",
            slug: nf,
          })
        ).toBeNull();
        expect(
          yield* fixture
            .as("student")
            .query(folders.list, { classId, slug: nf })
        ).toMatchObject([{ id: added.id, name: "Gerak lurus" }]);
      })
  );

  it.effect(
    "refuses a student, a folder of another class, and a class that holds the most folders it can",
    () =>
      Effect.gen(function* () {
        const { classId, fixture, term } = yield* libraryClass();
        const teacher = fixture.as("teacher");
        const added = yield* teacher.mutation(folders.add, {
          classId,
          clientKey: "folder-1",
          name: "Bab 1",
          parentId: null,
          slug: nf,
        });
        const other = yield* forumClass(fixture, term.id, "X-2", false);
        const named = { folderId: added.id, slug: nf };
        const refusals = yield* Effect.all([
          fixture
            .as("student")
            .mutation(folders.add, {
              classId,
              clientKey: "folder-liar",
              name: "Liar",
              parentId: null,
              slug: nf,
            })
            .pipe(Effect.flip),
          fixture
            .as("student")
            .mutation(folders.trash, { ...named, classId })
            .pipe(Effect.flip),
          teacher
            .mutation(folders.rename, {
              ...named,
              classId: other.classId,
              name: "Liar",
            })
            .pipe(Effect.flip),
          teacher
            .mutation(folders.trash, { ...named, classId: other.classId })
            .pipe(Effect.flip),
        ]);
        expect(refusals).toMatchObject([
          denied("role"),
          denied("role"),
          denied("resource"),
          denied("resource"),
        ]);

        const [first] = yield* fixture.run(folderRows);
        yield* fixture.run(
          Effect.gen(function* () {
            const writer = yield* DatabaseWriter;
            yield* Effect.forEach(
              Arr.range(2, FOLDER_LIMIT),
              (number) =>
                first === undefined
                  ? Effect.void
                  : writer.table("classroomFolders").insert({
                      ...Struct.omit(first, ["_creationTime", "_id"]),
                      clientKey: `folder-${number}`,
                    }),
              { discard: true }
            );
          }).pipe(Effect.orDie)
        );
        expect(
          yield* teacher
            .mutation(folders.add, {
              classId,
              clientKey: "satu-lagi",
              name: "Satu lagi",
              parentId: null,
              slug: nf,
            })
            .pipe(Effect.flip)
        ).toMatchObject({ _tag: "FolderLimit" });
      })
  );

  it.effect(
    "keeps a link and a file in the folder they were added to, moves an item, and shows each list only its own",
    () =>
      Effect.gen(function* () {
        const { classId, fixture, term } = yield* libraryClass();
        const teacher = fixture.as("teacher");
        const folder = yield* teacher.mutation(folders.add, {
          classId,
          clientKey: "folder-1",
          name: "Bab 1",
          parentId: null,
          slug: nf,
        });
        const inFolder = yield* teacher.mutation(library.addLink, {
          address: "https://youtu.be/satu",
          classId,
          clientKey: "di-folder",
          folderId: folder.id,
          slug: nf,
          title: "Di folder",
        });
        expect(inFolder.folderId).toBe(folder.id);
        const top = yield* teacher.mutation(library.addLink, {
          address: "https://youtu.be/dua",
          classId,
          clientKey: "item-di-atas",
          folderId: null,
          slug: nf,
          title: "Di atas",
        });
        yield* addFile(
          bucket,
          fixture,
          classId,
          "berkas-pdf",
          PDF,
          "application/pdf",
          "Berkas",
          folder.id
        );

        const titles = (folderId: typeof folder.id | null) =>
          teacher
            .query(library.list, { ...firstPage, classId, folderId, slug: nf })
            .pipe(Effect.map(({ page }) => Arr.map(page, (it) => it.title)));
        expect(yield* titles(null)).toEqual(["Di atas"]);
        expect(yield* titles(folder.id)).toEqual(["Berkas", "Di folder"]);

        yield* teacher.mutation(library.edit, {
          address: null,
          classId,
          folderId: folder.id,
          itemId: top.id,
          slug: nf,
          title: "Di atas",
        });
        expect(yield* titles(null)).toEqual([]);
        yield* teacher.mutation(library.edit, {
          address: null,
          classId,
          folderId: null,
          itemId: top.id,
          slug: nf,
          title: "Di atas",
        });
        expect(yield* titles(null)).toEqual(["Di atas"]);

        const other = yield* forumClass(fixture, term.id, "X-2", false);
        const foreign = yield* teacher.mutation(folders.add, {
          classId: other.classId,
          clientKey: "folder-lain",
          name: "Lain",
          parentId: null,
          slug: nf,
        });
        expect(
          yield* teacher
            .mutation(library.edit, {
              address: null,
              classId,
              folderId: foreign.id,
              itemId: top.id,
              slug: nf,
              title: "Di atas",
            })
            .pipe(Effect.flip)
        ).toMatchObject(denied("resource"));
        // A folder of another class never takes an item, which stays in the library at its top.
        const placed = yield* teacher.mutation(library.addLink, {
          address: "https://youtu.be/tiga",
          classId,
          clientKey: "tanpa-folder",
          folderId: foreign.id,
          slug: nf,
          title: "Tanpa folder",
        });
        expect(placed.folderId).toBeNull();
      })
  );

  it.effect(
    "nests folders at any depth, refuses a move into itself, moves a folder and an item, and stars each for the reader alone",
    () =>
      Effect.gen(function* () {
        const { classId, fixture } = yield* libraryClass();
        const teacher = fixture.as("teacher");
        const add = (clientKey: string, parentId: typeof folderId | null) =>
          teacher.mutation(folders.add, {
            classId,
            clientKey,
            name: clientKey,
            parentId,
            slug: nf,
          });
        const top = yield* add("Bab", null);
        const folderId = top.id;
        const child = yield* add("Sub", top.id);
        const grandchild = yield* add("Subsub", child.id);
        expect(grandchild.parentId).toBe(child.id);
        expect(
          yield* teacher
            .mutation(folders.move, {
              classId,
              folderId: top.id,
              parentId: grandchild.id,
              slug: nf,
            })
            .pipe(Effect.flip)
        ).toMatchObject({ _tag: "FolderCycle" });
        yield* teacher.mutation(folders.move, {
          classId,
          folderId: grandchild.id,
          parentId: null,
          slug: nf,
        });
        yield* teacher.mutation(folders.move, {
          classId,
          folderId: grandchild.id,
          parentId: top.id,
          slug: nf,
        });
        const link = yield* teacher.mutation(library.addLink, {
          address: "https://youtu.be/satu",
          classId,
          clientKey: "tautan",
          folderId: null,
          slug: nf,
          title: "Tautan",
        });
        yield* teacher.mutation(library.move, {
          classId,
          folderId: child.id,
          itemId: link.id,
          slug: nf,
        });
        yield* teacher.mutation(library.move, {
          classId,
          folderId: null,
          itemId: link.id,
          slug: nf,
        });
        const student = fixture.as("student");
        const star = (
          target:
            | { readonly kind: "item"; readonly itemId: typeof link.id }
            | { readonly kind: "folder"; readonly folderId: typeof top.id },
          starred: boolean
        ) =>
          student.mutation(library.star, {
            classId,
            slug: nf,
            starred,
            target,
          });
        yield* star({ itemId: link.id, kind: "item" }, true);
        yield* star({ itemId: link.id, kind: "item" }, true);
        yield* star({ folderId: top.id, kind: "folder" }, true);
        expect(
          Arr.map(
            yield* student.query(library.starred, { classId, slug: nf }),
            (item) => item.title
          )
        ).toEqual(["Tautan"]);
        expect(
          Arr.filter(
            yield* student.query(folders.list, { classId, slug: nf }),
            (folder) => folder.starred
          )
        ).toMatchObject([{ id: top.id }]);
        expect(
          yield* teacher.query(library.starred, { classId, slug: nf })
        ).toEqual([]);
        yield* star({ itemId: link.id, kind: "item" }, false);
        yield* star({ itemId: link.id, kind: "item" }, false);
        expect(
          yield* student.query(library.starred, { classId, slug: nf })
        ).toEqual([]);
        expect(
          yield* student.query(library.search, {
            classId,
            slug: nf,
            text: "taut",
          })
        ).toMatchObject([{ id: link.id }]);
        expect(
          yield* student.query(library.search, {
            classId,
            slug: nf,
            text: "zzz",
          })
        ).toEqual([]);
      })
  );

  it.effect(
    "hides a trashed folder with everything inside it, restores it to the top when its parent is gone, and deletes a tree forever with its files",
    () =>
      Effect.gen(function* () {
        const { classId, fixture } = yield* libraryClass();
        const teacher = fixture.as("teacher");
        const add = (clientKey: string, parentId: typeof folderId | null) =>
          teacher.mutation(folders.add, {
            classId,
            clientKey,
            name: clientKey,
            parentId,
            slug: nf,
          });
        const top = yield* add("Bab", null);
        const folderId = top.id;
        const child = yield* add("Sub", top.id);
        const file = yield* addFile(
          bucket,
          fixture,
          classId,
          "berkas",
          PDF,
          "application/pdf",
          "Berkas",
          child.id
        );
        yield* fixture.as("student").mutation(library.star, {
          classId,
          slug: nf,
          starred: true,
          target: { itemId: file.id, kind: "item" },
        });
        yield* fixture.as("student").mutation(library.star, {
          classId,
          slug: nf,
          starred: true,
          target: { folderId: child.id, kind: "folder" },
        });
        yield* teacher.mutation(folders.trash, {
          classId,
          folderId: top.id,
          slug: nf,
        });
        expect(
          yield* fixture
            .as("student")
            .query(library.starred, { classId, slug: nf })
        ).toEqual([]);
        expect(
          yield* fixture
            .as("student")
            .query(library.search, { classId, slug: nf, text: "Berkas" })
        ).toEqual([]);
        yield* teacher.mutation(folders.restore, {
          classId,
          folderId: top.id,
          slug: nf,
        });
        yield* teacher.mutation(folders.trash, {
          classId,
          folderId: child.id,
          slug: nf,
        });
        yield* teacher.mutation(folders.purge, {
          classId,
          folderId: top.id,
          slug: nf,
        });
        expect(yield* fixture.run(folderRows)).toHaveLength(0);
        // A folder whose parent is gone comes back at the top of the library.
        const orphan = yield* add("Yatim", top.id);
        yield* teacher.mutation(folders.trash, {
          classId,
          folderId: orphan.id,
          slug: nf,
        });
        yield* teacher.mutation(folders.restore, {
          classId,
          folderId: orphan.id,
          slug: nf,
        });
        expect(
          yield* teacher.query(folders.list, { classId, slug: nf })
        ).toMatchObject([{ id: orphan.id, parentId: null, trashedAt: null }]);
        yield* fixture.finishScheduled();
        expect(bucket.state.objects).toEqual({});
        const left = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            Effect.all([
              reader
                .table("classroomLibrary")
                .index("by_creation_time")
                .take(10),
              reader.table("classroomStars").index("by_creation_time").take(10),
            ])
          )
        );
        expect(left).toEqual([[], []]);
      })
  );

  it.effect(
    "deletes a folder of more files than one pass holds over several passes",
    () =>
      Effect.gen(function* () {
        const { classId, fixture } = yield* libraryClass();
        const teacher = fixture.as("teacher");
        const folder = yield* teacher.mutation(folders.add, {
          classId,
          clientKey: "besar",
          name: "Besar",
          parentId: null,
          slug: nf,
        });
        const link = yield* teacher.mutation(library.addLink, {
          address: "https://youtu.be/satu",
          classId,
          clientKey: "tautan-0",
          folderId: folder.id,
          slug: nf,
          title: "Tautan",
        });
        yield* fixture.run(
          Effect.gen(function* () {
            const reader = yield* DatabaseReader;
            const writer = yield* DatabaseWriter;
            const row = yield* reader.table("classroomLibrary").get(link.id);
            yield* Effect.forEach(
              Arr.range(1, 70),
              (number) =>
                writer.table("classroomLibrary").insert({
                  ...Struct.omit(row, ["_creationTime", "_id"]),
                  clientKey: `tautan-${number}`,
                }),
              { discard: true }
            );
          }).pipe(Effect.orDie)
        );
        yield* teacher.mutation(folders.purge, {
          classId,
          folderId: folder.id,
          slug: nf,
        });
        yield* fixture.finishScheduled();
        expect(
          yield* fixture.run(
            Effect.flatMap(DatabaseReader, (reader) =>
              reader
                .table("classroomLibrary")
                .index("by_creation_time")
                .take(10)
            )
          )
        ).toEqual([]);
      })
  );
});
