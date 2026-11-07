import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { BUCKET_BYTE_LIMIT } from "@repo/backend/confect/bucket/use";
import { SCHOOL_BYTE_LIMIT } from "@repo/backend/confect/classroom/forum/use";
import { LIBRARY_BYTE_LIMIT } from "@repo/backend/confect/classroom/library/file";
import { makeBucket, stubBucket, upload } from "@repo/backend/test/bucket";
import {
  denied,
  firstPage,
  forumClass,
  nf,
} from "@repo/backend/test/classroom";
import { otherSchoolTeacher } from "@repo/backend/test/editor";
import { addFile, libraryClass, PDF, PNG } from "@repo/backend/test/library";
import { TENANCY_NOW } from "@repo/backend/test/tenancy";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect, Exit, Record as Rec } from "effect";

/** The fetch that R2 and the Drive import call, stubbed once for the file. */
const fetcher = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetcher);

const library = refs.public.classroom.library;
const internal = refs.internal.classroom.library;

/** Every row of the class libraries, so a test reads what the server stored. */
const libraryRows = Effect.flatMap(DatabaseReader, (reader) =>
  reader.table("classroomLibrary").index("by_creation_time").take(100)
);

/** Every reservation still waiting. */
const reservations = Effect.flatMap(DatabaseReader, (reader) =>
  reader.table("classroomLibraryUploads").index("by_creation_time").take(100)
);

/** The one R2 the file's tests share, emptied before each test. */
const bucket = makeBucket();

describe("classroom/library", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
    fetcher.mockReset();
    fetcher.mockImplementation((input, init) => bucket.answer(input, init));
    bucket.state.objects = {};
    bucket.state.failing = false;
    stubBucket();
    vi.stubEnv("GOOGLE_CONNECTORS", "drive");
    vi.stubEnv("GOOGLE_PICKER_API_KEY", "picker-key");
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
            folderId: null,
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
        const listed = yield* fixture.as("student").query(library.list, {
          folderId: null,
          ...firstPage,
          classId,
          slug: nf,
        });
        expect(listed.page).toEqual([added]);
        const byStudent = yield* fixture
          .as("student")
          .mutation(library.addLink, {
            folderId: null,
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
    "reserves bytes before the upload, registers a PDF and an image from R2, keeps one reservation for a repeated client key, and opens each at a signed address",
    () =>
      Effect.gen(function* () {
        const { classId, fixture } = yield* libraryClass();
        const teacher = fixture.as("teacher");
        expect(
          yield* teacher.query(library.canAdd, { classId, slug: nf })
        ).toEqual({ authorId: fixture.people.teacher.personId });
        const module = yield* addFile(
          bucket,
          fixture,
          classId,
          "module-file",
          PDF,
          "application/pdf",
          "Modul gerak lurus"
        );
        expect(module.address).toContain(
          "X-Amz-SignedHeaders=content-length%3Bcontent-type%3Bhost"
        );
        vi.setSystemTime(TENANCY_NOW + 1000);
        const reserve = () =>
          teacher.mutation(library.reserve, {
            byteSize: PNG.byteLength,
            classId,
            clientKey: "photo-file",
            contentType: "image/png",
            folderId: null,
            slug: nf,
            title: "Foto praktikum",
          });
        const first = yield* reserve();
        expect((yield* reserve()).uploadId).toBe(first.uploadId);
        upload(bucket, first.address, PNG);
        yield* teacher.action(library.register, {
          classId,
          slug: nf,
          uploadId: first.uploadId,
        });
        const listed = yield* fixture.as("student").query(library.list, {
          folderId: null,
          ...firstPage,
          classId,
          slug: nf,
        });
        expect(
          Arr.map(listed.page, (item) => [
            item.kind,
            item.title,
            item.byteSize,
            item.address,
          ])
        ).toEqual([
          ["image", "Foto praktikum", PNG.byteLength, null],
          ["pdf", "Modul gerak lurus", PDF.byteLength, null],
        ]);
        expect(yield* fixture.run(reservations)).toHaveLength(0);
        const opened = yield* fixture.as("student").mutation(library.open, {
          classId,
          download: true,
          itemId: module.id,
          slug: nf,
        });
        expect(opened).toContain("response-content-disposition=attachment");
        expect(opened).toContain("Modul%2520gerak%2520lurus.pdf");
        const shown = yield* fixture.as("student").mutation(library.open, {
          classId,
          download: false,
          itemId: listed.page[0]?.id ?? module.id,
          slug: nf,
        });
        expect(shown).toContain("response-content-disposition=inline");
        expect(shown).toContain("response-content-type=image%2Fpng");
      })
  );

  it.effect(
    "refuses an upload that never arrived, bytes that are no PDF or image, a size other than reserved, and a file over the limit, freeing each one's bytes",
    () =>
      Effect.gen(function* () {
        const { classId, fixture, term } = yield* libraryClass();
        const teacher = fixture.as("teacher");
        const reserve = (clientKey: string, byteSize: number) =>
          teacher.mutation(library.reserve, {
            byteSize,
            classId,
            clientKey,
            contentType: "application/pdf",
            folderId: null,
            slug: nf,
            title: "Berkas",
          });
        const register = (
          uploadId: Effect.Success<ReturnType<typeof reserve>>["uploadId"],
          to = classId
        ) =>
          teacher
            .action(library.register, { classId: to, slug: nf, uploadId })
            .pipe(Effect.flip);
        const missing = yield* reserve("missing-file", PDF.byteLength);
        expect(yield* register(missing.uploadId)).toMatchObject({
          _tag: "UploadMissing",
        });
        // Another class of the same teacher never registers this class's reservation.
        const other = yield* forumClass(fixture, term.id, "X-2", false);
        expect(yield* register(missing.uploadId, other.classId)).toMatchObject({
          _tag: "UploadMissing",
        });
        const html = yield* reserve("html-file", 6);
        upload(bucket, html.address, new TextEncoder().encode("<html>"));
        expect(yield* register(html.uploadId)).toMatchObject({
          _tag: "FileTypeRefused",
        });
        const short = yield* reserve("short-file", PDF.byteLength + 1);
        upload(bucket, short.address, PDF);
        expect(yield* register(short.uploadId)).toMatchObject({
          _tag: "FileTypeRefused",
        });
        expect(yield* register(short.uploadId)).toMatchObject({
          _tag: "UploadMissing",
        });
        yield* fixture.finishScheduled();
        expect(Rec.keys(bucket.state.objects)).toHaveLength(0);
        expect(
          yield* reserve("large-file", LIBRARY_BYTE_LIMIT + 1).pipe(Effect.flip)
        ).toMatchObject({ _tag: "FileSizeRefused" });
        expect(yield* fixture.run(libraryRows)).toHaveLength(0);
        expect(
          yield* fixture.internal
            .mutation(internal.commit, { uploadId: html.uploadId })
            .pipe(Effect.flip)
        ).toMatchObject({ _tag: "UploadMissing" });
        expect(
          yield* fixture.internal.mutation(internal.discard, {
            uploadId: html.uploadId,
          })
        ).toBeNull();
        expect(
          yield* fixture.internal.query(internal.upload, {
            classId,
            uploadId: missing.uploadId,
          })
        ).toMatchObject({ byteSize: PDF.byteLength, classId });
        expect(
          yield* fixture.internal.query(internal.upload, {
            classId: other.classId,
            uploadId: missing.uploadId,
          })
        ).toBeNull();
        expect(
          yield* fixture.internal.query(internal.upload, {
            classId,
            uploadId: html.uploadId,
          })
        ).toBeNull();
      })
  );

  it.effect(
    "refuses a reservation past the school's limit, the bucket's limit, and the day's free writes",
    () =>
      Effect.gen(function* () {
        const { classId, fixture } = yield* libraryClass();
        const reserve = (clientKey: string) =>
          fixture
            .as("teacher")
            .mutation(library.reserve, {
              byteSize: PDF.byteLength,
              classId,
              clientKey,
              contentType: "application/pdf",
              folderId: null,
              slug: nf,
              title: "Berkas",
            })
            .pipe(Effect.flip);
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("bucketUse").insert({ bytes: BUCKET_BYTE_LIMIT })
          ).pipe(Effect.orDie)
        );
        expect(yield* reserve("bucket-full")).toMatchObject({
          _tag: "StorageFull",
          reason: "bucket",
        });
        const tenantId = fixture.tenants.nf;
        yield* fixture.run(
          Effect.gen(function* () {
            const writer = yield* DatabaseWriter;
            const use = yield* (yield* DatabaseReader)
              .table("bucketUse")
              .index("by_creation_time")
              .first();
            if (use._tag === "Some") {
              yield* writer
                .table("bucketUse")
                .patch(use.value._id, { bytes: 0 });
            }
            yield* writer
              .table("classroomFileUse")
              .insert({ bytes: SCHOOL_BYTE_LIMIT, tenantId });
          }).pipe(Effect.orDie)
        );
        expect(yield* reserve("school-full")).toMatchObject({
          _tag: "StorageFull",
          reason: "school",
        });
      })
  );

  it.effect(
    "refuses a reservation and a registration to a student and to a teacher of another school, and an opening of a trashed item",
    () =>
      Effect.gen(function* () {
        const { classId, fixture } = yield* libraryClass();
        const student = fixture.as("student");
        const args = {
          byteSize: PDF.byteLength,
          classId,
          clientKey: "outside-file",
          contentType: "application/pdf" as const,
          folderId: null,
          slug: nf,
          title: "Modul",
        };
        expect(
          yield* student.mutation(library.reserve, args).pipe(Effect.flip)
        ).toMatchObject(denied("role"));
        const reserved = yield* fixture
          .as("teacher")
          .mutation(library.reserve, args);
        const register = { classId, slug: nf, uploadId: reserved.uploadId };
        expect(
          yield* student.action(library.register, register).pipe(Effect.flip)
        ).toMatchObject({ _tag: "AccessDenied" });
        const other = yield* otherSchoolTeacher(fixture);
        expect(
          yield* other.action(library.register, register).pipe(Effect.flip)
        ).toMatchObject({ _tag: "AccessDenied" });
        const link = yield* fixture.as("teacher").mutation(library.addLink, {
          address: "https://nakafa.com/id",
          classId,
          clientKey: "trashed-link",
          folderId: null,
          slug: nf,
          title: "Nakafa",
        });
        expect(
          yield* student.mutation(library.open, {
            classId,
            download: false,
            itemId: link.id,
            slug: nf,
          })
        ).toBe("https://nakafa.com/id");
        yield* fixture.as("teacher").mutation(library.trash, {
          classId,
          itemId: link.id,
          slug: nf,
        });
        expect(
          yield* student
            .mutation(library.open, {
              classId,
              download: false,
              itemId: link.id,
              slug: nf,
            })
            .pipe(Effect.flip)
        ).toMatchObject({ _tag: "AccessDenied" });
      })
  );
});
