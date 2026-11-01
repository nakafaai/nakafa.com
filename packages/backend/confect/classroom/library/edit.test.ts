import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
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
import { Effect } from "effect";

const library = refs.public.classroom.library;

/** The leading bytes of a PDF, which the library keeps. */
const pdf = () =>
  new Blob(["%PDF-1.7\n1 0 obj\n"], { type: "application/pdf" });

/** Every row of the class libraries, so a test reads what the server stored. */
const libraryRows = Effect.flatMap(DatabaseReader, (reader) =>
  reader.table("classroomLibrary").index("by_creation_time").take(100)
);

/** A class taught by the fixture's teacher with the fixture's student placed in it. */
const libraryClass = Effect.fn("test.library.class")(function* () {
  const fixture = yield* keyedFixture;
  const term = yield* period(fixture, fixture.units.smp);
  const forum = yield* forumClass(fixture, term.id, "X-1");
  return { classId: forum.classId, fixture, term };
});

describe("classroom/library edit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "changes a link's title and address under its seal, keeps the address when none is sent, and refuses a student and another class's item",
    () =>
      Effect.gen(function* () {
        const { classId, fixture, term } = yield* libraryClass();
        const teacher = fixture.as("teacher");
        const added = yield* teacher.mutation(library.addLink, {
          folderId: null,
          address: "https://youtu.be/lama",
          classId,
          clientKey: "edited-link",
          slug: nf,
          title: "Video lama",
        });
        expect(
          yield* teacher.mutation(library.edit, {
            folderId: null,
            address: "https://youtu.be/baru",
            classId,
            itemId: added.id,
            slug: nf,
            title: "Video baru",
          })
        ).toBeNull();
        yield* teacher.mutation(library.edit, {
          folderId: null,
          address: null,
          classId,
          itemId: added.id,
          slug: nf,
          title: "Video pilihan",
        });
        const listed = yield* teacher.query(library.list, {
          folderId: null,
          ...firstPage,
          classId,
          slug: nf,
        });
        expect(listed.page).toMatchObject([
          { address: "https://youtu.be/baru", title: "Video pilihan" },
        ]);
        expect(encodeJsonText(yield* fixture.run(libraryRows))).not.toContain(
          "pilihan"
        );
        const other = yield* forumClass(fixture, term.id, "X-2", false);
        const edit = {
          address: null,
          itemId: added.id,
          slug: nf,
          title: "Liar",
        };
        const refusals = yield* Effect.all([
          fixture
            .as("student")
            .mutation(library.edit, { folderId: null, ...edit, classId })
            .pipe(Effect.flip),
          fixture
            .as("teacher")
            .mutation(library.edit, {
              folderId: null,
              ...edit,
              classId: other.classId,
            })
            .pipe(Effect.flip),
        ]);
        expect(refusals).toMatchObject([denied("role"), denied("resource")]);
      })
  );

  it.effect("retitles a file and leaves its bytes alone", () =>
    Effect.gen(function* () {
      const { classId, fixture } = yield* libraryClass();
      const storageId = yield* storeFile(fixture.convex, pdf());
      const teacher = fixture.as("teacher");
      const { id } = yield* teacher.action(library.register, {
        folderId: null,
        classId,
        clientKey: "edited-file",
        slug: nf,
        storageId,
        title: "Modul lama",
      });
      yield* teacher.mutation(library.edit, {
        folderId: null,
        address: "https://example.com/abaikan",
        classId,
        itemId: id,
        slug: nf,
        title: "Modul baru",
      });
      const listed = yield* teacher.query(library.list, {
        folderId: null,
        ...firstPage,
        classId,
        slug: nf,
      });
      expect(listed.page).toMatchObject([
        { byteSize: expect.any(Number), kind: "pdf", title: "Modul baru" },
      ]);
    })
  );
});
