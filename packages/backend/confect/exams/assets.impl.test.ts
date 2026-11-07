import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { MAX_ASSET_READS } from "@repo/backend/confect/exams/asset";
import { AUDIO_BYTE_LIMIT } from "@repo/backend/confect/exams/media";
import { fileRows, makeBucket, stubBucket } from "@repo/backend/test/bucket";
import { nf, otherSchoolTeacher } from "@repo/backend/test/editor";
import { examFile, PNG } from "@repo/backend/test/exams";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { IMAGE_BYTE_LIMIT } from "@repo/editor/upload";
import { Array as Arr, Effect } from "effect";

/** The fetch that R2 answers, stubbed once for the file. */
const fetcher = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetcher);
const bucket = makeBucket();

const { create, duplicate, open } = refs.public.exams.exams;
const questions = refs.public.exams.questions;
const { canAdd, media, register, registerAudio, reserve, urls } =
  refs.public.exams.assets;
const { sweep } = refs.internal.exams.assets;

/** A clip whose leading bytes name an MP3 file. */
const mp3 = (bytes = 8) =>
  Uint8Array.from([0x49, 0x44, 0x33, ...Arr.makeBy(bytes, () => 0)]);

/** Every row of the clips, so a test reads what the server stored. */
const audioRows = Effect.flatMap(DatabaseReader, (reader) =>
  reader.table("examAudio").index("by_creation_time").take(100)
);

/** Every row of the images, so a test reads what the server stored. */
const assetRows = Effect.flatMap(DatabaseReader, (reader) =>
  reader.table("examAssets").index("by_creation_time").take(100)
);

/** A new exam of the fixture's unit, which a test works on. */
const newExam = (fixture: Effect.Success<typeof tenancyFixture>) =>
  fixture.as("teacher").mutation(create, {
    scope: { kind: "unit", unitId: fixture.units.smp },
    slug: nf,
    title: "PTS Matematika",
  });

describe("exams/assets", () => {
  beforeEach(() => {
    bucket.state.objects = {};
    fetcher.mockImplementation((input, init) => bucket.answer(input, init));
    stubBucket();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "reserves a file at an R2 address for a teacher who may edit an exam, refuses one over its kind's limit, and refuses a student",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const made = yield* newExam(fixture);
        const args = {
          contentType: "image/png",
          examId: made.id,
          slug: nf,
        };
        const reserved = yield* teacher.mutation(reserve, {
          ...args,
          byteSize: 8,
          kind: "image",
        });
        expect(reserved.address).toContain("X-Amz-Signature=");
        const refusals = yield* Effect.all([
          teacher
            .mutation(reserve, {
              ...args,
              byteSize: IMAGE_BYTE_LIMIT + 1,
              kind: "image",
            })
            .pipe(Effect.flip),
          teacher
            .mutation(reserve, {
              ...args,
              byteSize: AUDIO_BYTE_LIMIT + 1,
              kind: "audio",
            })
            .pipe(Effect.flip),
          fixture
            .as("student")
            .mutation(reserve, { ...args, byteSize: 8, kind: "image" })
            .pipe(Effect.flip),
        ]);
        expect(refusals).toMatchObject([
          { _tag: "AssetSizeRefused" },
          { _tag: "AudioSizeRefused" },
          { _tag: "AccessDenied" },
        ]);
        expect(yield* fixture.run(fileRows)).toHaveLength(1);
      })
  );

  it.effect(
    "registers a PNG file as an image of the exam, and reads its address in one call",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const made = yield* newExam(fixture);
        const registered = yield* teacher.action(register, {
          examId: made.id,
          fileId: yield* examFile(bucket, fixture, made.id, PNG),
          height: 1,
          slug: nf,
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
        const made = yield* newExam(fixture);
        const fileId = yield* examFile(
          bucket,
          fixture,
          made.id,
          new TextEncoder().encode("%PDF-1.7 not an image")
        );
        const refused = yield* teacher
          .action(register, {
            examId: made.id,
            height: 1,
            slug: nf,
            fileId,
            width: 1,
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "AssetTypeRefused" });
        expect(yield* fixture.run(assetRows)).toHaveLength(0);
        expect(yield* fixture.run(fileRows)).toEqual([]);
      })
  );

  it.effect(
    "refuses a file whose bytes are over the image limit before it reads the file's type",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const made = yield* newExam(fixture);
        const fileId = yield* examFile(
          bucket,
          fixture,
          made.id,
          new Uint8Array(IMAGE_BYTE_LIMIT + 1),
          "audio"
        );
        const refused = yield* teacher
          .action(register, {
            examId: made.id,
            height: 1,
            slug: nf,
            fileId,
            width: 1,
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "AssetSizeRefused" });
        expect(yield* fixture.run(assetRows)).toHaveLength(0);
      })
  );

  it.effect("refuses an image and a clip whose bytes never arrived", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const teacher = fixture.as("teacher");
      const made = yield* newExam(fixture);
      const reserved = (kind: "audio" | "image") =>
        teacher.mutation(reserve, {
          byteSize: 8,
          contentType: kind === "image" ? "image/png" : "audio/mpeg",
          examId: made.id,
          kind,
          slug: nf,
        });
      const image = yield* reserved("image");
      const clip = yield* reserved("audio");
      const refusals = yield* Effect.all([
        teacher
          .action(register, {
            examId: made.id,
            fileId: image.fileId,
            height: 1,
            slug: nf,
            width: 1,
          })
          .pipe(Effect.flip),
        teacher
          .action(registerAudio, {
            examId: made.id,
            fileId: clip.fileId,
            slug: nf,
          })
          .pipe(Effect.flip),
      ]);
      expect(refusals).toMatchObject([
        { _tag: "AssetTypeRefused" },
        { _tag: "AudioTypeRefused" },
      ]);
    })
  );

  it.effect(
    "refuses a registration to a student as an access denial, and to a member of another school the same way",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const made = yield* newExam(fixture);
        const fileId = yield* examFile(bucket, fixture, made.id, PNG);
        const byStudent = yield* fixture
          .as("student")
          .action(register, {
            examId: made.id,
            height: 1,
            slug: nf,
            fileId,
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
            fileId,
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
            const fileId = yield* examFile(bucket, fixture, examId, PNG);
            const registered = yield* teacher.action(register, {
              examId,
              fileId,
              height: 1,
              slug: nf,
              width: 1,
            });
            return { fileId, id: registered.id };
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
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("bucketFiles").delete(gone.fileId)
          ).pipe(Effect.orDie)
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
    "sweeps the images of a deleted exam a page at a time, each file with its row",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* fixture.as("teacher").mutation(create, {
          scope: { kind: "unit", unitId: fixture.units.smp },
          slug: nf,
          title: "PTS Matematika",
        });
        yield* fixture.run(
          Effect.gen(function* () {
            const exam = yield* (yield* DatabaseReader)
              .table("exams")
              .get(made.id)
              .pipe(Effect.orDie);
            const writer = yield* DatabaseWriter;
            yield* Effect.forEach(
              Arr.makeBy(MAX_ASSET_READS + 1, (index) => index),
              (index) =>
                writer
                  .table("bucketFiles")
                  .insert({
                    byteSize: PNG.byteLength,
                    contentType: "image/png",
                    createdAt: TENANCY_NOW,
                    objectKey: `files/nf/${index}`,
                    state: "stored",
                    tenantId: exam.tenantId,
                  })
                  .pipe(
                    Effect.flatMap((fileId) =>
                      writer.table("examAssets").insert({
                        byteSize: PNG.byteLength,
                        contentType: "image/png",
                        createdAt: TENANCY_NOW,
                        createdBy: exam.createdBy,
                        examId: made.id,
                        fileId,
                        height: 30,
                        tenantId: exam.tenantId,
                        width: 40,
                      })
                    ),
                    Effect.orDie
                  )
            );
          })
        );
        expect(
          yield* fixture.internal.mutation(sweep, { examId: made.id })
        ).toEqual({ done: false });
        expect(yield* fixture.run(assetRows)).toHaveLength(1);
        yield* fixture.finishScheduled();
        expect(yield* fixture.run(assetRows)).toEqual([]);
        expect(yield* fixture.run(fileRows)).toEqual([]);
      })
  );

  it.effect(
    "registers an MP3 clip, plays it on its question, and sweeps it with its exam",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const made = yield* teacher.mutation(create, {
          scope: { kind: "unit", unitId: fixture.units.smp },
          slug: nf,
          title: "Listening",
        });
        const clip = yield* teacher.action(registerAudio, {
          examId: made.id,
          fileId: yield* examFile(bucket, fixture, made.id, mp3(), "audio"),
          slug: nf,
        });
        const exam = yield* teacher.query(open, { examId: made.id, slug: nf });
        const questionId = exam.questions[0].id;
        yield* teacher.mutation(questions.media, {
          examId: made.id,
          media: [{ alt: "Percakapan", asset: clip.id, kind: "audio" }],
          questionId,
          slug: nf,
        });
        const played = yield* teacher.query(media, {
          examId: made.id,
          questionId,
          slug: nf,
        });
        expect(played).toMatchObject([{ alt: "Percakapan", kind: "audio" }]);

        yield* fixture.internal.mutation(sweep, { examId: made.id });
        expect(yield* fixture.run(audioRows)).toHaveLength(0);
        const gone = yield* teacher.query(media, {
          examId: made.id,
          questionId,
          slug: nf,
        });
        expect(gone).toEqual([]);
      })
  );

  it.effect(
    "refuses a file that is no clip and a clip over its limit, keeps nothing, and refuses a student",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const made = yield* teacher.mutation(create, {
          scope: { kind: "unit", unitId: fixture.units.smp },
          slug: nf,
          title: "Listening",
        });
        const ids = { examId: made.id, slug: nf };
        const notAudio = yield* examFile(
          bucket,
          fixture,
          made.id,
          PNG,
          "audio"
        );
        const wrong = yield* teacher
          .action(registerAudio, { ...ids, fileId: notAudio })
          .pipe(Effect.flip);
        expect(wrong).toMatchObject({ _tag: "AudioTypeRefused" });
        const large = yield* examFile(
          bucket,
          fixture,
          made.id,
          mp3(AUDIO_BYTE_LIMIT),
          "audio",
          8
        );
        const tooLarge = yield* teacher
          .action(registerAudio, { ...ids, fileId: large })
          .pipe(Effect.flip);
        expect(tooLarge).toMatchObject({ _tag: "AudioSizeRefused" });
        expect(yield* fixture.run(audioRows)).toHaveLength(0);
        const own = yield* examFile(bucket, fixture, made.id, mp3(), "audio");
        const refused = yield* fixture
          .as("student")
          .action(registerAudio, { ...ids, fileId: own })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "AccessDenied" });
      })
  );

  it.effect("refuses a clip of another exam on a question", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const teacher = fixture.as("teacher");
      const first = yield* teacher.mutation(create, {
        scope: { kind: "unit", unitId: fixture.units.smp },
        slug: nf,
        title: "Satu",
      });
      const second = yield* teacher.mutation(create, {
        scope: { kind: "unit", unitId: fixture.units.smp },
        slug: nf,
        title: "Dua",
      });
      const clip = yield* teacher.action(registerAudio, {
        examId: first.id,
        slug: nf,
        fileId: yield* examFile(bucket, fixture, first.id, mp3(), "audio"),
      });
      const exam = yield* teacher.query(open, { examId: second.id, slug: nf });
      const refused = yield* teacher
        .mutation(questions.media, {
          examId: second.id,
          media: [{ alt: "Percakapan", asset: clip.id, kind: "audio" }],
          questionId: exam.questions[0].id,
          slug: nf,
        })
        .pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "AccessDenied" });
    })
  );

  it.effect(
    "gives a duplicate its own rows of the exam's files, and keeps a file while another exam names it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const made = yield* newExam(fixture);
        yield* teacher.action(register, {
          examId: made.id,
          fileId: yield* examFile(bucket, fixture, made.id, PNG),
          height: 1,
          slug: nf,
          width: 1,
        });
        const { id } = yield* teacher.action(registerAudio, {
          examId: made.id,
          fileId: yield* examFile(bucket, fixture, made.id, mp3(), "audio"),
          slug: nf,
        });
        const [question] = made.questions;
        yield* teacher.mutation(questions.media, {
          examId: made.id,
          media: [{ alt: "Percakapan", asset: id, kind: "audio" }],
          questionId: question.id,
          slug: nf,
        });

        const copied = yield* teacher.mutation(duplicate, {
          examId: made.id,
          slug: nf,
          title: "PTS Bahasa (salinan)",
        });

        expect(yield* fixture.run(assetRows)).toHaveLength(2);
        expect(yield* fixture.run(audioRows)).toHaveLength(2);
        const [held] = copied.questions[0].media;
        expect(held).toMatchObject({ alt: "Percakapan", kind: "audio" });
        expect(held).not.toEqual({
          alt: "Percakapan",
          asset: id,
          kind: "audio",
        });

        // The copy goes, and the exam it came from keeps its files.
        yield* fixture.internal.mutation(sweep, { examId: copied.id });
        expect(yield* fixture.run(assetRows)).toHaveLength(1);
        expect(yield* fixture.run(audioRows)).toHaveLength(1);
        expect(yield* fixture.run(fileRows)).toHaveLength(2);
      })
  );
});
