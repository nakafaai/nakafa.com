import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { LIBRARY_BYTE_LIMIT } from "@repo/backend/confect/classroom/library/file";
import { connect } from "@repo/backend/confect/connectors/connection";
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
import { TENANCY_NOW, type tenancyFixture } from "@repo/backend/test/tenancy";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect, Exit } from "effect";

/** The fetch that the Drive import calls, stubbed once for the file. */
const fetcher = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetcher);

const library = refs.public.classroom.library;

/** The leading bytes of a PDF, which the library keeps. */
const pdf = () =>
  new Blob(["%PDF-1.7\n1 0 obj\n"], { type: "application/pdf" });

/** Every row of the class libraries, so a test reads what the server stored. */
const libraryRows = Effect.flatMap(DatabaseReader, (reader) =>
  reader.table("classroomLibrary").index("by_creation_time").take(100)
);

/**
 * Google as the Drive import meets it: a refreshed token, the picked file's
 * metadata `file`, and its bytes `bytes`.
 */
const driveAnswers = (file: object, bytes: string) =>
  fetcher.mockImplementation((input) => {
    const url = String(input);
    if (url.startsWith("https://oauth2.googleapis.com/token")) {
      return Promise.resolve(
        new Response(
          encodeJsonText({
            access_token: "access",
            expires_in: 3599,
            scope: "",
          })
        )
      );
    }
    return Promise.resolve(
      new Response(url.includes("alt=media") ? bytes : encodeJsonText(file))
    );
  });

/** The Drive reads the import sent, by whether each asked for the bytes. */
const driveReads = () =>
  Arr.filter(
    Arr.map(fetcher.mock.calls, ([input]) => String(input)),
    (url) => url.startsWith("https://www.googleapis.com/drive/v3/files/")
  );

/** A personal Drive connection of the fixture's teacher. */
const teacherDrive = (fixture: Effect.Success<typeof tenancyFixture>) =>
  fixture.run(
    Effect.gen(function* () {
      const person = yield* (yield* DatabaseReader)
        .table("tenantPeople")
        .get(fixture.people.teacher.personId);
      if (person.account.state !== "claimed") {
        return yield* Effect.die("The teacher holds an account.");
      }
      const userId = person.account.userId;
      return yield* connect(
        { id: userId, kind: "user" },
        { kind: "personal", userId },
        {
          connector: "drive",
          googleSubject: "teacher-subject",
          refreshToken: "refresh-drive",
          scopes: ["openid"],
        }
      );
    }).pipe(Effect.orDie)
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
    fetcher.mockReset();
    vi.stubEnv("GOOGLE_CONNECTORS", "drive");
    vi.stubEnv("GOOGLE_CONNECTOR_CLIENT_ID", "client");
    vi.stubEnv("GOOGLE_CONNECTOR_CLIENT_SECRET", "secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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
        const added = yield* add("video-link", "https://youtu.be/gerak-lurus");
        expect(added).toMatchObject({
          address: "https://youtu.be/gerak-lurus",
          byteSize: null,
          kind: "link",
          title: "Video gerak lurus",
        });
        expect(yield* add("video-link", "https://example.com/other")).toEqual(
          added
        );
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
        const plain = yield* Effect.exit(
          add("plain-link", "http://example.com")
        );
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
        const module = yield* register(
          "module-file",
          pdf(),
          "Modul gerak lurus"
        );
        vi.setSystemTime(TENANCY_NOW + 1000);
        const photo = yield* register("photo-file", png(), "Foto praktikum");
        const repeat = yield* register("photo-file", png(), "Foto lagi");
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
                clientKey: "refused-file",
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
          clientKey: "outside-file",
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
          clientKey: "material-link",
          slug: nf,
          title: "Materi Nakafa",
        });
        const storageId = yield* storeFile(fixture.convex, pdf());
        const file = yield* teacher.action(library.register, {
          classId,
          clientKey: "module-file",
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
  it.effect(
    "imports a picked Drive PDF through the teacher's own Drive, once for a client key, and lists it as a file of the class",
    () =>
      Effect.gen(function* () {
        const { classId, fixture } = yield* libraryClass();
        yield* teacherDrive(fixture);
        const bytes = "%PDF-1.7\n1 0 obj\n";
        driveAnswers(
          { mimeType: "application/pdf", name: "Modul.pdf", size: "17" },
          bytes
        );
        const importDrive = (clientKey: string) =>
          fixture.as("teacher").action(library.importDrive, {
            classId,
            clientKey,
            fileId: "drive-file-1",
            slug: nf,
            title: "Modul dari Drive",
          });
        const imported = yield* importDrive("drive-module");
        expect((yield* importDrive("drive-module")).id).toBe(imported.id);
        expect(driveReads()).toHaveLength(4);
        const listed = yield* fixture
          .as("student")
          .query(library.list, { ...firstPage, classId, slug: nf });
        expect(listed.page).toMatchObject([
          {
            byteSize: bytes.length,
            id: imported.id,
            kind: "pdf",
            title: "Modul dari Drive",
          },
        ]);
      })
  );

  it.effect(
    "refuses a Google document, a file over the limit before reading its bytes, and bytes that are no PDF or image, storing nothing",
    () =>
      Effect.gen(function* () {
        const { classId, fixture } = yield* libraryClass();
        yield* teacherDrive(fixture);
        const refused = (file: object, bytes: string) => {
          fetcher.mockReset();
          driveAnswers(file, bytes);
          return fixture
            .as("teacher")
            .action(library.importDrive, {
              classId,
              clientKey: "drive-refused",
              fileId: "drive-file-2",
              slug: nf,
              title: "Berkas",
            })
            .pipe(Effect.flip);
        };
        const document = "application/vnd.google-apps.document";
        expect(
          yield* refused({ mimeType: document, name: "Catatan" }, "")
        ).toMatchObject({ _tag: "FileTypeRefused" });
        expect(
          yield* refused(
            {
              mimeType: "application/pdf",
              name: "Besar.pdf",
              size: String(LIBRARY_BYTE_LIMIT + 1),
            },
            "%PDF-"
          )
        ).toMatchObject({ _tag: "FileSizeRefused" });
        expect(driveReads()).toHaveLength(1);
        expect(
          yield* refused(
            { mimeType: "application/pdf", name: "Palsu.pdf", size: "6" },
            "<html>"
          )
        ).toMatchObject({ _tag: "FileTypeRefused" });
        expect(yield* fixture.run(libraryRows)).toHaveLength(0);
      })
  );

  it.effect(
    "refuses a Drive import to a teacher without Drive as a connector that is off, and to a student as an access denial",
    () =>
      Effect.gen(function* () {
        const { classId, fixture } = yield* libraryClass();
        const args = {
          classId,
          clientKey: "drive-outside",
          fileId: "drive-file-3",
          slug: nf,
          title: "Modul",
        };
        expect(
          yield* fixture
            .as("teacher")
            .action(library.importDrive, args)
            .pipe(Effect.flip)
        ).toMatchObject({ _tag: "ConnectorOff" });
        expect(
          yield* fixture
            .as("student")
            .action(library.importDrive, args)
            .pipe(Effect.flip)
        ).toMatchObject({ _tag: "AccessDenied" });
        expect(fetcher).not.toHaveBeenCalled();
      })
  );
});
