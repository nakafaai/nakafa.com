import type { GenericId, Ref } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { makeBucket, stubBucket } from "@repo/backend/test/bucket";
import {
  forumClass,
  keyedFixture,
  nf,
  period,
} from "@repo/backend/test/classroom";
import { TENANCY_NOW } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { folders, library } = refs.public.classroom;

/** A class taught by the fixture's teacher with the fixture's student placed in it. */
const libraryClass = Effect.fn("test.folders.class")(function* () {
  const fixture = yield* keyedFixture;
  const term = yield* period(fixture, fixture.units.smp);
  const forum = yield* forumClass(fixture, term.id, "X-1");
  return { classId: forum.classId, fixture, term };
});

/** The fetch that R2 answers, stubbed once for the file. */
const fetcher = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetcher);
const bucket = makeBucket();

describe("classroom/library nesting and stars", () => {
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
    "nests folders at any depth, refuses a move into itself, moves a folder and an item, and stars each for the reader alone",
    () =>
      Effect.gen(function* () {
        const { classId, fixture } = yield* libraryClass();
        const teacher = fixture.as("teacher");
        const add = (
          clientKey: string,
          parentId: GenericId.GenericId<"classroomFolders"> | null
        ) =>
          teacher.mutation(folders.add, {
            classId,
            clientKey: `folder-${clientKey}`,
            name: clientKey,
            parentId,
            slug: nf,
          });
        const top = yield* add("Bab", null);
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
        yield* teacher.mutation(folders.trash, {
          classId,
          folderId: grandchild.id,
          slug: nf,
        });
        yield* teacher.mutation(folders.restore, {
          classId,
          folderId: grandchild.id,
          slug: nf,
        });
        expect(
          Arr.findFirst(
            yield* teacher.query(folders.list, { classId, slug: nf }),
            (folder) => folder.id === grandchild.id
          )
        ).toMatchObject({ value: { parentId: top.id, trashedAt: null } });
        const link = yield* teacher.mutation(library.addLink, {
          address: "https://youtu.be/satu",
          classId,
          clientKey: "tautan-link",
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
        vi.setSystemTime(TENANCY_NOW + 1000);
        const later = yield* teacher.mutation(library.addLink, {
          address: "https://youtu.be/dua",
          classId,
          clientKey: "tautan-later",
          folderId: null,
          slug: nf,
          title: "Tautan baru",
        });
        const student = fixture.as("student");
        const star = (
          target: Ref.Args<typeof library.star>["target"],
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
        yield* star({ itemId: later.id, kind: "item" }, true);
        yield* star({ folderId: top.id, kind: "folder" }, true);
        yield* star({ folderId: top.id, kind: "folder" }, true);
        expect(
          Arr.map(
            yield* student.query(library.starred, { classId, slug: nf }),
            (item) => item.title
          )
        ).toEqual(["Tautan baru", "Tautan"]);
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
          Arr.map(
            yield* student.query(library.starred, { classId, slug: nf }),
            (item) => item.title
          )
        ).toEqual(["Tautan baru"]);
        expect(
          yield* student.query(library.search, {
            classId,
            slug: nf,
            text: "taut",
          })
        ).toMatchObject([{ id: later.id }, { id: link.id }]);
        expect(
          yield* student.query(library.search, {
            classId,
            slug: nf,
            text: "zzz",
          })
        ).toEqual([]);
      })
  );
});
