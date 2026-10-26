import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { nf, otherSchoolTeacher } from "@repo/backend/test/editor";
import { png } from "@repo/backend/test/exams";
import { storeFile } from "@repo/backend/test/logo";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { IMAGE_BYTE_LIMIT } from "@repo/editor/upload";
import { Array as Arr, Effect, Exit } from "effect";

const { create } = refs.public.exams.exams;
const { canAdd, register, uploadUrl, urls } = refs.public.exams.assets;
const { discard, stored } = refs.internal.exams.assets;

/** Every row of the images, so a test reads what the server stored. */
const assetRows = Effect.flatMap(DatabaseReader, (reader) =>
  reader.table("examAssets").index("by_creation_time").take(100)
);

describe("exams/assets", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "gives a teacher who may edit an exam an address to upload to, and refuses a student",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const made = yield* teacher.mutation(create, {
          scope: { kind: "unit", unitId: fixture.units.smp },
          slug: nf,
          title: "PTS Matematika",
        });
        const url = yield* teacher.mutation(uploadUrl, {
          examId: made.id,
          slug: nf,
        });
        expect(url.href.startsWith("http")).toBe(true);
        const refused = yield* fixture
          .as("student")
          .mutation(uploadUrl, { examId: made.id, slug: nf })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "AccessDenied" });
      })
  );

  it.effect(
    "registers a PNG file as an image of the exam, and reads its address in one call",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const made = yield* teacher.mutation(create, {
          scope: { kind: "unit", unitId: fixture.units.smp },
          slug: nf,
          title: "PTS Matematika",
        });
        const storageId = yield* storeFile(fixture.convex, png());
        const registered = yield* teacher.action(register, {
          examId: made.id,
          height: 1,
          slug: nf,
          storageId,
          width: 1,
        });
        const read = yield* teacher.query(urls, {
          assets: [registered.id],
          examId: made.id,
          slug: nf,
        });
        expect(read).toHaveLength(1);
        expect(read[0]).toMatchObject({ id: registered.id });
        expect(yield* fixture.run(assetRows)).toHaveLength(1);
      })
  );

  it.effect(
    "refuses a file whose leading bytes are no image the editor accepts, and stores nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const made = yield* teacher.mutation(create, {
          scope: { kind: "unit", unitId: fixture.units.smp },
          slug: nf,
          title: "PTS Matematika",
        });
        const storageId = yield* storeFile(
          fixture.convex,
          new Blob(["%PDF-1.7 not an image"], { type: "image/png" })
        );
        const refused = yield* teacher
          .action(register, {
            examId: made.id,
            height: 1,
            slug: nf,
            storageId,
            width: 1,
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "AssetTypeRefused" });
        expect(yield* fixture.run(assetRows)).toHaveLength(0);
      })
  );

  it.effect(
    "refuses a file over the byte limit before it reads the file's type",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const made = yield* teacher.mutation(create, {
          scope: { kind: "unit", unitId: fixture.units.smp },
          slug: nf,
          title: "PTS Matematika",
        });
        const storageId = yield* storeFile(
          fixture.convex,
          new Blob([new Uint8Array(IMAGE_BYTE_LIMIT + 1)], {
            type: "image/png",
          })
        );
        const refused = yield* teacher
          .action(register, {
            examId: made.id,
            height: 1,
            slug: nf,
            storageId,
            width: 1,
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "AssetSizeRefused" });
        expect(yield* fixture.run(assetRows)).toHaveLength(0);
      })
  );

  it.effect(
    "refuses a registration to a student as an access denial, and to a member of another school the same way",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const made = yield* teacher.mutation(create, {
          scope: { kind: "unit", unitId: fixture.units.smp },
          slug: nf,
          title: "PTS Matematika",
        });
        const storageId = yield* storeFile(fixture.convex, png());
        const byStudent = yield* fixture
          .as("student")
          .action(register, {
            examId: made.id,
            height: 1,
            slug: nf,
            storageId,
            width: 1,
          })
          .pipe(Effect.flip);
        expect(byStudent).toMatchObject({ _tag: "AccessDenied" });
        const other = yield* otherSchoolTeacher(fixture);
        const byOther = yield* other
          .action(register, {
            examId: made.id,
            height: 1,
            slug: nf,
            storageId,
            width: 1,
          })
          .pipe(Effect.flip);
        expect(byOther).toMatchObject({ _tag: "AccessDenied" });
        expect(
          yield* teacher.query(canAdd, { examId: made.id, slug: nf })
        ).toEqual({});
      })
  );

  it.effect(
    "refuses to read the address of an image of another exam, and leaves out an image whose row or file is gone",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const scope = { kind: "unit" as const, unitId: fixture.units.smp };
        const first = yield* teacher.mutation(create, {
          scope,
          slug: nf,
          title: "PTS Matematika",
        });
        const second = yield* teacher.mutation(create, {
          scope,
          slug: nf,
          title: "PTS Biologi",
        });
        const registerIn = (examId: typeof second.id) =>
          Effect.gen(function* () {
            const storageId = yield* storeFile(fixture.convex, png());
            const registered = yield* teacher.action(register, {
              examId,
              height: 1,
              slug: nf,
              storageId,
              width: 1,
            });
            return { id: registered.id, storageId };
          });
        const gone = yield* registerIn(second.id);
        const rowGone = yield* registerIn(second.id);
        const kept = yield* registerIn(second.id);
        const foreign = yield* teacher
          .query(urls, { assets: [kept.id], examId: first.id, slug: nf })
          .pipe(Effect.flip);
        expect(foreign).toMatchObject({ _tag: "AccessDenied" });
        const ids = [gone.id, rowGone.id, kept.id];
        expect(
          yield* teacher.query(urls, {
            assets: ids,
            examId: second.id,
            slug: nf,
          })
        ).toHaveLength(3);
        yield* Effect.promise(() =>
          fixture.convex.run((ctx) => ctx.storage.delete(gone.storageId))
        );
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("examAssets").delete(rowGone.id).pipe(Effect.orDie)
          )
        );
        const read = yield* teacher.query(urls, {
          assets: ids,
          examId: second.id,
          slug: nf,
        });
        expect(Arr.map(read, (address) => address.id)).toEqual([kept.id]);
      })
  );

  it.effect(
    "reads the size of a stored file, and fails as a defect for a file the storage no longer holds",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const storageId = yield* storeFile(fixture.convex, png());
        expect(yield* fixture.internal.query(stored, { storageId })).toEqual({
          size: png().size,
        });
        yield* Effect.promise(() =>
          fixture.convex.run((ctx) => ctx.storage.delete(storageId))
        );
        const exit = yield* fixture.internal
          .query(stored, { storageId })
          .pipe(Effect.exit);
        expect(Exit.isFailure(exit)).toBe(true);
      })
  );

  it.effect(
    "discards a stored file, so no file of a refused image is kept",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const storageId = yield* storeFile(fixture.convex, png());
        yield* fixture.internal.mutation(discard, { storageId });
        const address = yield* Effect.promise(() =>
          fixture.convex.run((ctx) => ctx.storage.getUrl(storageId))
        );
        expect(address).toBeNull();
      })
  );
});
