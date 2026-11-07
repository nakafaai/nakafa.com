import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  AUDIO_BYTE_LIMIT,
  audioTypeOf,
  videoIdOf,
} from "@repo/backend/confect/exams/media";
import { makeBucket, stubBucket } from "@repo/backend/test/bucket";
import { nf } from "@repo/backend/test/editor";
import { examFile, PNG } from "@repo/backend/test/exams";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Option } from "effect";

/** The bytes of an ASCII text. */
const ascii = (text: string) =>
  Arr.map(Arr.fromIterable(text), (letter) => letter.charCodeAt(0));

/** A file's leading bytes. */
const head = (...bytes: readonly number[]) => Uint8Array.from(bytes);

describe("exams/media audioTypeOf", () => {
  it("names a clip by its leading bytes", () => {
    expect(audioTypeOf(head(...ascii("ID3"), 4))).toEqual(
      Option.some("audio/mpeg")
    );
    expect(audioTypeOf(head(0xff, 0xfb, 0x90))).toEqual(
      Option.some("audio/mpeg")
    );
    expect(audioTypeOf(head(0, 0, 0, 32, ...ascii("ftypM4A ")))).toEqual(
      Option.some("audio/mp4")
    );
    expect(audioTypeOf(head(...ascii("OggS")))).toEqual(
      Option.some("audio/ogg")
    );
    expect(
      audioTypeOf(head(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WAVE")))
    ).toEqual(Option.some("audio/wav"));
  });

  it("refuses a file that is no clip, an image in RIFF included", () => {
    expect(Option.isNone(audioTypeOf(head(0x89, 0x50, 0x4e, 0x47)))).toBe(true);
    expect(
      Option.isNone(
        audioTypeOf(head(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP")))
      )
    ).toBe(true);
    expect(Option.isNone(audioTypeOf(head()))).toBe(true);
  });
});

describe("exams/media videoIdOf", () => {
  it("reads the video of every link YouTube shares", () => {
    for (const link of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=10",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "https://youtube.com/shorts/dQw4w9WgXcQ",
    ]) {
      expect(videoIdOf(link)).toEqual(Option.some("dQw4w9WgXcQ"));
    }
  });

  it("refuses any other link and text that is no link", () => {
    expect(Option.isNone(videoIdOf("https://vimeo.com/76979871"))).toBe(true);
    expect(Option.isNone(videoIdOf("https://youtu.be/short"))).toBe(true);
    expect(Option.isNone(videoIdOf("video pelajaran"))).toBe(true);
  });
});

/** The fetch that R2 answers, stubbed once for the file. */
const fetcher = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetcher);
const bucket = makeBucket();

const { create, open } = refs.public.exams.exams;
const questions = refs.public.exams.questions;
const { media, registerAudio } = refs.public.exams.assets;
const { sweep } = refs.internal.exams.assets;

/** A clip whose leading bytes name an MP3 file. */
const mp3 = (bytes = 8) =>
  Uint8Array.from([0x49, 0x44, 0x33, ...Arr.makeBy(bytes, () => 0)]);

/** Every row of the clips, so a test reads what the server stored. */
const audioRows = Effect.flatMap(DatabaseReader, (reader) =>
  reader.table("examAudio").index("by_creation_time").take(100)
);

describe("exams/media clips", () => {
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
});
