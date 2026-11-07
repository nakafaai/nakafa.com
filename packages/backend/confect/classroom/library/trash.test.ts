import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  refundBucket,
  spendOperations,
} from "@repo/backend/confect/bucket/use";
import { STAR_LIMIT } from "@repo/backend/confect/classroom/library/star";
import { makeBucket, stubBucket, upload } from "@repo/backend/test/bucket";
import { firstPage, nf } from "@repo/backend/test/classroom";
import { addFile, libraryClass, PDF } from "@repo/backend/test/library";
import { TENANCY_NOW } from "@repo/backend/test/tenancy";
import { Array as Arr, Duration, Effect, Exit, Struct } from "effect";

/** The fetch that R2 answers, stubbed once for the file. */
const fetcher = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetcher);
const bucket = makeBucket();

const { folders, library } = refs.public.classroom;
const internal = refs.internal.classroom.library;

/** How many rows of each kind are left, so a test reads what the sweep removed. */
const counts = Effect.flatMap(DatabaseReader, (reader) =>
  Effect.all({
    folders: reader
      .table("classroomFolders")
      .index("by_creation_time")
      .take(200),
    items: reader.table("classroomLibrary").index("by_creation_time").take(200),
    uploads: reader
      .table("classroomLibraryUploads")
      .index("by_creation_time")
      .take(200),
  }).pipe(Effect.map((rows) => Struct.map(rows, (found) => found.length)))
);

describe("classroom/library trash", () => {
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
    "lists the trash newest first, restores an item to its folder or to the top when its folder is trashed, and deletes forever with the file's object",
    () =>
      Effect.gen(function* () {
        const { classId, fixture } = yield* libraryClass();
        const teacher = fixture.as("teacher");
        const folder = yield* teacher.mutation(folders.add, {
          classId,
          clientKey: "folder-bab",
          name: "Bab",
          parentId: null,
          slug: nf,
        });
        const file = yield* addFile(
          bucket,
          fixture,
          classId,
          "berkas-file",
          PDF,
          "application/pdf",
          "Berkas",
          folder.id
        );
        const link = yield* teacher.mutation(library.addLink, {
          address: "https://youtu.be/satu",
          classId,
          clientKey: "tautan-link",
          folderId: folder.id,
          slug: nf,
          title: "Tautan",
        });
        const trash = (itemId: typeof link.id) =>
          teacher.mutation(library.trash, { classId, itemId, slug: nf });
        yield* trash(file.id);
        vi.setSystemTime(TENANCY_NOW + 1000);
        yield* trash(link.id);
        const trashed = yield* teacher.query(library.trashed, {
          ...firstPage,
          classId,
          slug: nf,
        });
        expect(Arr.map(trashed.page, (item) => item.title)).toEqual([
          "Tautan",
          "Berkas",
        ]);
        yield* teacher.mutation(library.restore, {
          classId,
          itemId: link.id,
          slug: nf,
        });
        yield* teacher.mutation(folders.trash, {
          classId,
          folderId: folder.id,
          slug: nf,
        });
        yield* teacher.mutation(library.restore, {
          classId,
          itemId: file.id,
          slug: nf,
        });
        const top = yield* teacher.query(library.list, {
          ...firstPage,
          classId,
          folderId: null,
          slug: nf,
        });
        expect(top.page).toMatchObject([{ folderId: null, title: "Berkas" }]);
        yield* teacher.mutation(library.purge, {
          classId,
          itemId: file.id,
          slug: nf,
        });
        yield* fixture.finishScheduled();
        expect(bucket.state.objects).toEqual({});
      })
  );

  it.effect(
    "frees an upload that never registered and deletes what waited thirty days in the trash, a full batch at a time",
    () =>
      Effect.gen(function* () {
        const { classId, fixture } = yield* libraryClass();
        const teacher = fixture.as("teacher");
        const reserved = yield* teacher.mutation(library.reserve, {
          byteSize: PDF.byteLength,
          classId,
          clientKey: "tertinggal",
          contentType: "application/pdf",
          folderId: null,
          slug: nf,
          title: "Tertinggal",
        });
        upload(bucket, reserved.address, PDF);
        const folder = yield* teacher.mutation(folders.add, {
          classId,
          clientKey: "folder-lama",
          name: "Lama",
          parentId: null,
          slug: nf,
        });
        yield* teacher.mutation(folders.trash, {
          classId,
          folderId: folder.id,
          slug: nf,
        });
        const link = yield* teacher.mutation(library.addLink, {
          address: "https://youtu.be/satu",
          classId,
          clientKey: "tautan-0",
          folderId: null,
          slug: nf,
          title: "Tautan",
        });
        yield* teacher.mutation(library.trash, {
          classId,
          itemId: link.id,
          slug: nf,
        });
        yield* fixture.run(
          Effect.gen(function* () {
            const row = yield* (yield* DatabaseReader)
              .table("classroomLibrary")
              .get(link.id);
            const writer = yield* DatabaseWriter;
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
        vi.setSystemTime(TENANCY_NOW + Duration.toMillis(Duration.days(31)));
        yield* fixture.internal.mutation(internal.sweep, {});
        yield* fixture.finishScheduled();
        expect(yield* fixture.run(counts)).toEqual({
          folders: 0,
          items: 0,
          uploads: 0,
        });
        expect(bucket.state.objects).toEqual({});
      })
  );

  it.effect(
    "refuses the day's free operations once spent, frees nothing from an empty bucket, and keeps a Person's stars at the limit",
    () =>
      Effect.gen(function* () {
        const { classId, fixture } = yield* libraryClass();
        // Four shards hold the day's 30,000 writes and one call takes at most two of them, so the third call of 15,000 is refused at the latest.
        const spent = yield* Effect.forEach(Arr.range(1, 3), () =>
          Effect.exit(fixture.run(spendOperations("bucketWrite", 15_000)))
        );
        expect(Arr.some(spent, Exit.isFailure)).toBe(true);
        yield* fixture.run(refundBucket(10));
        const link = yield* fixture.as("teacher").mutation(library.addLink, {
          address: "https://youtu.be/satu",
          classId,
          clientKey: "tautan-link",
          folderId: null,
          slug: nf,
          title: "Tautan",
        });
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            Effect.forEach(
              Arr.range(1, STAR_LIMIT),
              () =>
                writer.table("classroomStars").insert({
                  classId,
                  itemId: link.id,
                  kind: "item",
                  personId: fixture.people.student.personId,
                }),
              { discard: true }
            )
          ).pipe(Effect.orDie)
        );
        const folder = yield* fixture.as("teacher").mutation(folders.add, {
          classId,
          clientKey: "folder-bab",
          name: "Bab",
          parentId: null,
          slug: nf,
        });
        yield* fixture.as("student").mutation(library.star, {
          classId,
          slug: nf,
          starred: true,
          target: { folderId: folder.id, kind: "folder" },
        });
        const stars = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("classroomStars").index("by_creation_time").take(300)
          )
        );
        expect(stars).toHaveLength(STAR_LIMIT);
      })
  );
});
