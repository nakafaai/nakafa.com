import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { nf } from "@repo/backend/test/editor";
import { teacherExam } from "@repo/backend/test/exams";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const { open } = refs.public.exams.exams;
const { copy, media } = refs.public.exams.questions;
const assets = refs.public.exams.assets;

/** A teacher's video, as a question holds it. */
const video = { alt: "Video", kind: "video", video: "dQw4w9WgXcQ" } as const;

describe("exams/questions media", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "keeps a question's video, copies it, and reads it back as the paper plays it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const exam = yield* teacherExam(fixture, "Media");
        const [first] = exam.questions;
        const ids = { examId: exam.id, slug: nf };

        expect(first.media).toEqual([]);
        const saved = yield* teacher.mutation(media, {
          ...ids,
          media: [video],
          questionId: first.id,
        });
        expect(saved.media).toEqual([video]);
        const copied = yield* teacher.mutation(copy, {
          ...ids,
          questionId: first.id,
        });
        expect(copied.media).toEqual([video]);
        const played = yield* teacher.query(assets.media, {
          ...ids,
          questionId: first.id,
        });
        expect(played).toEqual([video]);
        const opened = yield* teacher.query(open, ids);
        expect(opened.questions[0].media).toEqual([video]);
      })
  );

  it.effect(
    "refuses a question of another exam and more media than it holds",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const exam = yield* teacherExam(fixture, "Media");
        const other = yield* teacherExam(fixture, "Lain");
        const refused = yield* teacher
          .query(assets.media, {
            examId: exam.id,
            questionId: other.questions[0].id,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(String(refused)).toContain("AccessDenied");
        const tooMany = yield* teacher
          .mutation(media, {
            examId: exam.id,
            media: [video, video, video, video],
            questionId: exam.questions[0].id,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(String(tooMany)).not.toBe("");
      })
  );
});
