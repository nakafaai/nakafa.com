import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { ASSET_BYTE_LIMIT } from "@repo/backend/confect/exams/asset";
import { nf, otherSchoolTeacher } from "@repo/backend/test/editor";
import { LANGUAGE } from "@repo/backend/test/exams";
import { storeFile } from "@repo/backend/test/logo";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const { create } = refs.public.exams.exams;
const { canAdd, register, uploadUrl, urls } = refs.public.exams.assets;
const { discard, removeForExam } = refs.internal.exams.assets;

/** The leading bytes of a PNG file, which the server reads as an image. */
const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** A PNG file of a few bytes, which the server accepts as an image. */
const png = () =>
  new Blob([Uint8Array.from([...PNG_HEAD, 0, 0, 0, 0])], { type: "image/png" });

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
          language: LANGUAGE,
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
          language: LANGUAGE,
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
          language: LANGUAGE,
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
          language: LANGUAGE,
          scope: { kind: "unit", unitId: fixture.units.smp },
          slug: nf,
          title: "PTS Matematika",
        });
        const storageId = yield* storeFile(
          fixture.convex,
          new Blob([new Uint8Array(ASSET_BYTE_LIMIT + 1)], {
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
          language: LANGUAGE,
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
    "refuses to read the address of an image of another exam, and leaves out an image that is gone",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const scope = { kind: "unit" as const, unitId: fixture.units.smp };
        const first = yield* teacher.mutation(create, {
          language: LANGUAGE,
          scope,
          slug: nf,
          title: "PTS Matematika",
        });
        const second = yield* teacher.mutation(create, {
          language: LANGUAGE,
          scope,
          slug: nf,
          title: "PTS Biologi",
        });
        const storageId = yield* storeFile(fixture.convex, png());
        const image = yield* teacher.action(register, {
          examId: second.id,
          height: 1,
          slug: nf,
          storageId,
          width: 1,
        });
        const foreign = yield* teacher
          .query(urls, { assets: [image.id], examId: first.id, slug: nf })
          .pipe(Effect.flip);
        expect(foreign).toMatchObject({ _tag: "AccessDenied" });
        yield* fixture.internal.mutation(removeForExam, { examId: second.id });
        expect(
          yield* teacher.query(urls, {
            assets: [image.id],
            examId: second.id,
            slug: nf,
          })
        ).toEqual([]);
      })
  );

  it.effect(
    "deletes the images of an exam with their files, and reports the batch that is left",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const made = yield* teacher.mutation(create, {
          language: LANGUAGE,
          scope: { kind: "unit", unitId: fixture.units.smp },
          slug: nf,
          title: "PTS Matematika",
        });
        for (let index = 0; index < 2; index += 1) {
          const storageId = yield* storeFile(fixture.convex, png());
          yield* teacher.action(register, {
            examId: made.id,
            height: 1,
            slug: nf,
            storageId,
            width: 1,
          });
        }
        expect(yield* fixture.run(assetRows)).toHaveLength(2);
        const removed = yield* fixture.internal.mutation(removeForExam, {
          examId: made.id,
        });
        expect(removed).toEqual({ done: true });
        expect(yield* fixture.run(assetRows)).toHaveLength(0);
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
