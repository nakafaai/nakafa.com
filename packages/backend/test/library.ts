import type { GenericId } from "@confect/core";
import refs from "@repo/backend/confect/_generated/refs";
import { type makeBucket, upload } from "@repo/backend/test/bucket";
import {
  forumClass,
  keyedFixture,
  nf,
  period,
} from "@repo/backend/test/classroom";
import type { tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const library = refs.public.classroom.library;

/** The bytes of a small PDF, which the library keeps. */
export const PDF = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n");

/** The signature and header of a PNG, which the library keeps as an image. */
export const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48,
  0x44, 0x52,
]);

/** A class taught by the fixture's teacher with the fixture's student placed in it. */
export const libraryClass = Effect.fn("test.library.class")(function* (
  name = "X-1"
) {
  const fixture = yield* keyedFixture;
  const term = yield* period(fixture, fixture.units.smp);
  const forum = yield* forumClass(fixture, term.id, name);
  return { classId: forum.classId, fixture, term };
});

/** Reserves, uploads, and registers one file as the teacher, as the browser does. */
export const addFile = Effect.fn("test.library.addFile")(function* (
  bucket: ReturnType<typeof makeBucket>,
  fixture: Effect.Success<typeof tenancyFixture>,
  classId: GenericId.GenericId<"classes">,
  clientKey: string,
  bytes: Uint8Array,
  contentType: "application/pdf" | "image/png",
  title: string,
  folderId: GenericId.GenericId<"classroomFolders"> | null = null
) {
  const teacher = fixture.as("teacher");
  const reserved = yield* teacher.mutation(library.reserve, {
    byteSize: bytes.byteLength,
    classId,
    clientKey,
    contentType,
    folderId,
    slug: nf,
    title,
  });
  upload(bucket, reserved.address, bytes);
  const registered = yield* teacher.action(library.register, {
    classId,
    slug: nf,
    uploadId: reserved.uploadId,
  });
  return { ...registered, ...reserved };
});
