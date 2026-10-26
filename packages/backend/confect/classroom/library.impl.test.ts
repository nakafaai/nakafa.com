import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { LIBRARY_BYTE_LIMIT } from "@repo/backend/confect/classroom/library/file";
import {
  denied,
  firstPage,
  forumClass,
  keyedFixture,
  nf,
  period,
} from "@repo/backend/test/classroom";
import { otherSchoolTeacher } from "@repo/backend/test/editor";
import { png } from "@repo/backend/test/exams";
import { storageUrl, storeFile } from "@repo/backend/test/logo";
import { TENANCY_NOW } from "@repo/backend/test/tenancy";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect, Exit } from "effect";

const library = refs.public.classroom.library;

/** The leading bytes of a PDF, which the library keeps. */
const pdf = () =>
  new Blob(["%PDF-1.7\n1 0 obj\n"], { type: "application/pdf" });

/** Every row of the class libraries, so a test reads what the server stored. */
const libraryRows = Effect.flatMap(DatabaseReader, (reader) =>
  reader.table("classroomLibrary").index("by_creation_time").take(100)
);

/** A class taught by the fixture's teacher with the fixture's student placed in it. */
const libraryClass = Effect.fn("test.library.class")(function* (name = "X-1") {
  const fixture = yield* keyedFixture;
  const term = yield* period(fixture, fixture.units.smp);
  const forum = yield* forumClass(fixture, term.id, name);
  return { classId: forum.classId, fixture, term };
});

describe("classroom/library", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "adds a sealed link once for a client key, lists it to the class, and refuses a student and an address that is not https",
    () =>
      Effect.gen(function* () {
        const { classId, fixture } = yield* libraryClass();
        const teacher = fixture.as("teacher");
        const add = (clientKey: string, address: string) =>
          teacher.mutation(library.addLink, {
            address,
            classId,
            clientKey,
            slug: nf,
            title: "Video gerak lurus",
          });
        const added = yield* add("video", "https://youtu.be/gerak-lurus");
        expect(added).toMatchObject({
          address: "https://youtu.be/gerak-lurus",
          byteSize: null,
          kind: "link",
          title: "Video gerak lurus",
        });
        expect(yield* add("video", "https://example.com/other")).toEqual(added);
        const stored = yield* fixture.run(libraryRows);
        expect(stored).toHaveLength(1);
        expect(encodeJsonText(stored)).not.toContain("gerak");
        const listed = yield* fixture
          .as("student")
          .query(library.list, { ...firstPage, classId, slug: nf });
        expect(listed.page).toEqual([added]);
        const byStudent = yield* fixture
          .as("student")
          .mutation(library.addLink, {
            address: "https://example.com",
            classId,
            clientKey: "student-link",
            slug: nf,
            title: "Tautan",
          })
          .pipe(Effect.flip);
        expect(byStudent).toMatchObject(denied("role"));
        const plain = yield* Effect.exit(add("plain", "http://example.com"));
        expect(Exit.isFailure(plain)).toBe(true);
        expect(yield* fixture.run(libraryRows)).toHaveLength(1);
      })
  );

  it.effect(
    "registers a PDF and an image by their bytes, newest first, keeps one item for a repeated client key, and reads each address for the reader",
    () =>
      Effect.gen(function* () {
        const { classId, fixture } = yield* libraryClass();
        const teacher = fixture.as("teacher");
        const url = yield* teacher.mutation(library.uploadUrl, {
          classId,
          slug: nf,
        });
        expect(url.href.startsWith("http")).toBe(true);
        expect(
          yield* teacher.query(library.canAdd, { classId, slug: nf })
        ).toEqual({ authorId: fixture.people.teacher.personId });
        const register = (clientKey: string, file: Blob, title: string) =>
          Effect.gen(function* () {
            const storageId = yield* storeFile(fixture.convex, file);
            const registered = yield* teacher.action(library.register, {
              classId,
              clientKey,
              slug: nf,
              storageId,
              title,
            });
            return { ...registered, storageId };
          });
        const module = yield* register("module", pdf(), "Modul gerak lurus");
        vi.setSystemTime(TENANCY_NOW + 1000);
        const photo = yield* register("photo", png(), "Foto praktikum");
        const repeat = yield* register("photo", png(), "Foto lagi");
        expect(repeat.id).toBe(photo.id);
        expect(yield* storageUrl(fixture.convex, repeat.storageId)).toBeNull();
        const listed = yield* fixture
          .as("student")
          .query(library.list, { ...firstPage, classId, slug: nf });
        expect(
          Arr.map(listed.page, (item) => [item.kind, item.title, item.byteSize])
        ).toEqual([
          ["image", "Foto praktikum", png().size],
          ["pdf", "Modul gerak lurus", pdf().size],
        ]);
        expect(listed.page[1]?.address).toBe(
          yield* storageUrl(fixture.convex, module.storageId)
        );
        yield* Effect.promise(() =>
          fixture.convex.run((ctx) => ctx.storage.delete(module.storageId))
        );
        const after = yield* fixture
          .as("student")
          .query(library.list, { ...firstPage, classId, slug: nf });
        expect(after.page[1]).toMatchObject({ address: null, kind: "pdf" });
      })
  );

  it.effect(
    "refuses and deletes a file whose bytes are no PDF or image, and a file over the limit before it reads its bytes",
    () =>
      Effect.gen(function* () {
        const { classId, fixture } = yield* libraryClass();
        const teacher = fixture.as("teacher");
        const refused = (file: Blob) =>
          Effect.gen(function* () {
            const storageId = yield* storeFile(fixture.convex, file);
            const failure = yield* teacher
              .action(library.register, {
                classId,
                clientKey: "refused",
                slug: nf,
                storageId,
                title: "Berkas",
              })
              .pipe(Effect.flip);
            expect(yield* storageUrl(fixture.convex, storageId)).toBeNull();
            return failure;
          });
        expect(
          yield* refused(new Blob(["<html>"], { type: "application/pdf" }))
        ).toMatchObject({ _tag: "FileTypeRefused" });
        expect(
          yield* refused(
            new Blob([new Uint8Array(LIBRARY_BYTE_LIMIT + 1)], {
              type: "application/pdf",
            })
          )
        ).toMatchObject({ _tag: "FileSizeRefused" });
        expect(yield* fixture.run(libraryRows)).toHaveLength(0);
      })
  );

  it.effect(
    "refuses an upload and a registration to a student, and to a teacher of another school, as an access denial",
    () =>
      Effect.gen(function* () {
        const { classId, fixture } = yield* libraryClass();
        const student = fixture.as("student");
        expect(
          yield* student
            .mutation(library.uploadUrl, { classId, slug: nf })
            .pipe(Effect.flip)
        ).toMatchObject(denied("role"));
        const storageId = yield* storeFile(fixture.convex, pdf());
        const args = {
          classId,
          clientKey: "outside",
          slug: nf,
          storageId,
          title: "Modul",
        };
        expect(
          yield* student.action(library.register, args).pipe(Effect.flip)
        ).toMatchObject({ _tag: "AccessDenied" });
        const other = yield* otherSchoolTeacher(fixture);
        expect(
          yield* other.action(library.register, args).pipe(Effect.flip)
        ).toMatchObject({ _tag: "AccessDenied" });
        expect(yield* fixture.run(libraryRows)).toHaveLength(0);
      })
  );

  it.effect(
    "removes a link and a file with its stored bytes, and refuses an item of another class as a missing object",
    () =>
      Effect.gen(function* () {
        const { classId, fixture, term } = yield* libraryClass();
        const other = yield* forumClass(fixture, term.id, "X-2", false);
        const teacher = fixture.as("teacher");
        const link = yield* teacher.mutation(library.addLink, {
          address: "https://nakafa.com/id/subject/high-school/10/physics",
          classId,
          clientKey: "material",
          slug: nf,
          title: "Materi Nakafa",
        });
        const storageId = yield* storeFile(fixture.convex, pdf());
        const file = yield* teacher.action(library.register, {
          classId,
          clientKey: "module",
          slug: nf,
          storageId,
          title: "Modul",
        });
        expect(
          yield* teacher
            .mutation(library.remove, {
              classId: other.classId,
              itemId: file.id,
              slug: nf,
            })
            .pipe(Effect.flip)
        ).toMatchObject(denied("resource"));
        yield* teacher.mutation(library.remove, {
          classId,
          itemId: file.id,
          slug: nf,
        });
        expect(yield* storageUrl(fixture.convex, storageId)).toBeNull();
        yield* teacher.mutation(library.remove, {
          classId,
          itemId: link.id,
          slug: nf,
        });
        expect(yield* fixture.run(libraryRows)).toHaveLength(0);
        expect(
          yield* teacher
            .mutation(library.remove, { classId, itemId: link.id, slug: nf })
            .pipe(Effect.flip)
        ).toMatchObject(denied("resource"));
      })
  );
});
