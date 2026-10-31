import type {
  ExamQuestionsDoc,
  ExamsDoc,
} from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
  StorageReader,
} from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import type { QuestionMedia } from "@repo/backend/confect/exams/media";
import { Array as Arr, Clock, Effect, Option } from "effect";

/** Refuses a clip of another exam as a missing object, so no question plays another school's file. */
const requireOwnClip = Effect.fn("exams.question.media.own")(function* (
  examId: ExamsDoc["_id"],
  media: QuestionMedia
) {
  if (media.kind !== "audio") {
    return;
  }
  const clip = yield* (yield* DatabaseReader)
    .table("examAudio")
    .get(media.asset)
    .pipe(Effect.option);
  if (Option.isNone(clip) || clip.value.examId !== examId) {
    return yield* new AccessDenied({ action: "exam.edit", reason: "resource" });
  }
});

/** Gives one question its media. Like its points, media leaves the revision. */
export const setMedia = Effect.fn("exams.question.media")(function* (
  exam: Pick<ExamsDoc, "_id">,
  question: Pick<ExamQuestionsDoc, "_id">,
  media: readonly QuestionMedia[]
) {
  yield* Effect.forEach(media, (item) => requireOwnClip(exam._id, item), {
    discard: true,
  });
  const at = yield* Clock.currentTimeMillis;
  yield* (yield* DatabaseWriter)
    .table("examQuestions")
    .patch(question._id, { media, updatedAt: at })
    .pipe(Effect.orDie);
});

/**
 * The media of a question as a paper plays it: each clip with its address. A clip whose file is gone is left out,
 * so the paper shows what still plays.
 */
export const playableMedia = Effect.fn("exams.question.media.playable")(
  function* (media: readonly QuestionMedia[]) {
    const reader = yield* DatabaseReader;
    const storage = yield* StorageReader;
    const items = yield* Effect.forEach(media, (item) =>
      item.kind === "video"
        ? Effect.succeed(Option.some(item))
        : reader
            .table("examAudio")
            .get(item.asset)
            .pipe(
              Effect.flatMap((clip) => storage.getUrl(clip.storageId)),
              Effect.map(({ href }) =>
                Option.some({
                  alt: item.alt,
                  kind: "audio" as const,
                  url: href,
                })
              ),
              Effect.orElseSucceed(() => Option.none())
            )
    );
    return Arr.getSomes(items);
  }
);
