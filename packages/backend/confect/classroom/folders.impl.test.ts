import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { FOLDER_LIMIT } from "@repo/backend/confect/classroom/library/folder";
import {
  denied,
  firstPage,
  forumClass,
  keyedFixture,
  nf,
  period,
} from "@repo/backend/test/classroom";
import { storeFile } from "@repo/backend/test/logo";
import { TENANCY_NOW } from "@repo/backend/test/tenancy";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect } from "effect";

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

/** The leading bytes of a PDF, which the library keeps. */
const pdf = () =>
  new Blob(["%PDF-1.7\n1 0 obj\n"], { type: "application/pdf" });

describe("classroom/folders", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
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
              slug: nf,
            })
            .pipe(Effect.flip),
          fixture
            .as("student")
            .mutation(folders.remove, { ...named, classId })
            .pipe(Effect.flip),
          teacher
            .mutation(folders.rename, {
              ...named,
              classId: other.classId,
              name: "Liar",
            })
            .pipe(Effect.flip),
          teacher
            .mutation(folders.remove, { ...named, classId: other.classId })
            .pipe(Effect.flip),
        ]);
        expect(refusals).toMatchObject([
          denied("role"),
          denied("role"),
          denied("resource"),
          denied("resource"),
        ]);

        yield* Effect.forEach(
          Arr.range(2, FOLDER_LIMIT),
          (number) =>
            teacher.mutation(folders.add, {
              classId,
              clientKey: `folder-${number}`,
              name: `Bab ${number}`,
              slug: nf,
            }),
          { discard: true }
        );
        expect(
          yield* teacher
            .mutation(folders.add, {
              classId,
              clientKey: "satu-lagi",
              name: "Satu lagi",
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
        yield* teacher.action(library.register, {
          classId,
          clientKey: "berkas-pdf",
          folderId: folder.id,
          slug: nf,
          storageId: yield* storeFile(fixture.convex, pdf()),
          title: "Berkas",
        });

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

  it.effect("leaves a removed folder's items at the top of the library", () =>
    Effect.gen(function* () {
      const { classId, fixture } = yield* libraryClass();
      const teacher = fixture.as("teacher");
      const folder = yield* teacher.mutation(folders.add, {
        classId,
        clientKey: "folder-1",
        name: "Bab 1",
        slug: nf,
      });
      yield* teacher.mutation(library.addLink, {
        address: "https://youtu.be/satu",
        classId,
        clientKey: "di-folder",
        folderId: folder.id,
        slug: nf,
        title: "Di folder",
      });
      expect(
        yield* teacher.mutation(folders.remove, {
          classId,
          folderId: folder.id,
          slug: nf,
        })
      ).toBeNull();
      expect(yield* teacher.query(folders.list, { classId, slug: nf })).toEqual(
        []
      );
      const { page } = yield* teacher.query(library.list, {
        ...firstPage,
        classId,
        folderId: null,
        slug: nf,
      });
      expect(page).toMatchObject([{ folderId: null, title: "Di folder" }]);
    })
  );
});
