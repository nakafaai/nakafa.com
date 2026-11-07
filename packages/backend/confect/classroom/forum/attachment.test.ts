import type { GenericId } from "@confect/core";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { THUMBNAIL_BYTE_LIMIT } from "@repo/backend/confect/classroom/forum/attachment";
import { SCHOOL_BYTE_LIMIT } from "@repo/backend/confect/classroom/forum/use";
import { LIBRARY_BYTE_LIMIT } from "@repo/backend/confect/classroom/library/file";
import {
  fileRows,
  makeBucket,
  stubBucket,
  uploadReserved,
} from "@repo/backend/test/bucket";
import {
  forumClass,
  keyedFixture,
  nf,
  period,
} from "@repo/backend/test/classroom";
import { otherSchoolTeacher } from "@repo/backend/test/editor";
import { PDF, PNG } from "@repo/backend/test/library";
import { TENANCY_NOW } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const { register, reserve } = refs.public.classroom.forum.files;

/** The fetch that R2 answers, stubbed once for the file. */
const fetcher = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetcher);
const bucket = makeBucket();

/** The bytes of a file that is no photo, PDF or office document. */
const TEXT = new TextEncoder().encode("hello");

/** Reserves one file of a class as its teacher and uploads its bytes as the browser does, answering the file's ID. */
const uploaded = (
  fixture: Effect.Success<typeof keyedFixture>,
  classId: GenericId.GenericId<"classes">,
  bytes: Uint8Array
) =>
  uploadReserved(
    bucket,
    fixture.as("teacher").mutation(reserve, {
      byteSize: bytes.byteLength,
      classId,
      contentType: "application/octet-stream",
      slug: nf,
    }),
    bytes
  );

/** A class with its general channel, whose teacher and student write in it. */
const classForum = Effect.gen(function* () {
  const fixture = yield* keyedFixture;
  const term = yield* period(fixture, fixture.units.smp);
  const forum = yield* forumClass(fixture, term.id, "X-1");
  return { fixture, forum };
});

describe("classroom/forum attachment refusals", () => {
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
    "gives whoever writes in the class an upload address, and refuses an outsider",
    () =>
      Effect.gen(function* () {
        const { fixture, forum } = yield* classForum;
        const args = { classId: forum.classId, slug: nf };
        const reserved = yield* fixture.as("teacher").mutation(reserve, {
          ...args,
          byteSize: PDF.byteLength,
          contentType: "application/pdf",
        });
        expect(reserved.address).toContain("X-Amz-Signature=");
        const outsider = yield* otherSchoolTeacher(fixture);
        const refused = yield* outsider
          .action(register, {
            ...args,
            height: null,
            name: "soal.pdf",
            fileId: yield* uploaded(fixture, forum.classId, PDF),
            thumbnailId: null,
            width: null,
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "AccessDenied" });
      })
  );

  it.effect(
    "refuses and deletes what is no photo, PDF or office document, a name it does not match included",
    () =>
      Effect.gen(function* () {
        const { fixture, forum } = yield* classForum;
        const args = {
          classId: forum.classId,
          height: null,
          slug: nf,
          thumbnailId: null,
          width: null,
        };
        const teacher = fixture.as("teacher");
        const script = yield* uploaded(fixture, forum.classId, TEXT);
        const disguised = yield* uploaded(fixture, forum.classId, TEXT);
        const failures = yield* Effect.all([
          teacher
            .action(register, { ...args, name: "virus.exe", fileId: script })
            .pipe(Effect.flip),
          teacher
            .action(register, {
              ...args,
              name: "tugas.docx",
              fileId: disguised,
            })
            .pipe(Effect.flip),
        ]);
        expect(failures).toMatchObject([
          { _tag: "AttachmentRefused" },
          { _tag: "AttachmentRefused" },
        ]);
        expect(yield* fixture.run(fileRows)).toEqual([]);
      })
  );

  it.effect(
    "refuses a file whose bytes never arrived, and one whose row is gone, and keeps neither",
    () =>
      Effect.gen(function* () {
        const { fixture, forum } = yield* classForum;
        const teacher = fixture.as("teacher");
        const args = {
          classId: forum.classId,
          height: null,
          name: "soal.pdf",
          slug: nf,
          thumbnailId: null,
          width: null,
        };
        const never = yield* teacher.mutation(reserve, {
          byteSize: PDF.byteLength,
          classId: forum.classId,
          contentType: "application/pdf",
          slug: nf,
        });
        const gone = yield* uploaded(fixture, forum.classId, PDF);
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("bucketFiles").delete(gone)
          ).pipe(Effect.orDie)
        );
        const failures = yield* Effect.all([
          teacher
            .action(register, { ...args, fileId: never.fileId })
            .pipe(Effect.flip),
          teacher.action(register, { ...args, fileId: gone }).pipe(Effect.flip),
        ]);
        expect(failures).toMatchObject([
          { _tag: "AttachmentRefused" },
          { _tag: "AttachmentRefused" },
        ]);
        expect(yield* fixture.run(fileRows)).toEqual([]);
      })
  );

  it.effect(
    "refuses a file past the limit, and a small copy that is no image or too large",
    () =>
      Effect.gen(function* () {
        const { fixture, forum } = yield* classForum;
        const teacher = fixture.as("teacher");
        const args = {
          classId: forum.classId,
          height: 1,
          name: "foto.png",
          slug: nf,
          width: 1,
        };
        const failures = yield* Effect.all([
          uploaded(
            fixture,
            forum.classId,
            new Uint8Array(LIBRARY_BYTE_LIMIT + 1)
          ).pipe(Effect.flip),
          teacher
            .action(register, {
              ...args,
              fileId: yield* uploaded(fixture, forum.classId, PNG),
              thumbnailId: yield* uploaded(
                fixture,
                forum.classId,
                new Uint8Array(THUMBNAIL_BYTE_LIMIT + 1)
              ),
            })
            .pipe(Effect.flip),
          teacher
            .action(register, {
              ...args,
              fileId: yield* uploaded(fixture, forum.classId, PNG),
              thumbnailId: yield* uploaded(fixture, forum.classId, PDF),
            })
            .pipe(Effect.flip),
        ]);
        expect(failures).toMatchObject([
          { _tag: "FileSizeRefused" },
          { _tag: "FileSizeRefused" },
          { _tag: "AttachmentRefused" },
        ]);
      })
  );

  it.effect("refuses to reserve a file past what the school's files hold", () =>
    Effect.gen(function* () {
      const { fixture, forum } = yield* classForum;
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer.table("classroomFileUse").insert({
            bytes: SCHOOL_BYTE_LIMIT,
            tenantId: fixture.tenants.nf,
          })
        )
      );
      const refused = yield* uploaded(fixture, forum.classId, PDF).pipe(
        Effect.flip
      );
      expect(refused).toMatchObject({ _tag: "StorageFull", reason: "school" });
      expect(yield* fixture.run(fileRows)).toEqual([]);
    })
  );
});
