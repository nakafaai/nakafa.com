import type {
  ExamAssetsDoc,
  ExamSittingsDoc,
} from "@repo/backend/confect/_generated/docs";
import { addressesOf } from "@repo/backend/confect/exams/addresses";
import {
  boundAttempt,
  requireOpen,
} from "@repo/backend/confect/exams/sittings/attempt";
import { Clock, Effect } from "effect";

/**
 * The addresses of the images that a student's paper draws, read by the bound device of an open
 * attempt in one call. The images must belong to the sitting's exam, so the read reaches the
 * images of this paper and no other, as `prompt` reaches only the questions of this paper.
 */
export const images = Effect.fn("exams.sittings.images")(function* (args: {
  assets: readonly ExamAssetsDoc["_id"][];
  deviceId: string;
  sittingId: ExamSittingsDoc["_id"];
}) {
  const { attempt, sitting } = yield* boundAttempt(
    args.sittingId,
    args.deviceId
  );
  yield* requireOpen(attempt, yield* Clock.currentTimeMillis);
  return yield* addressesOf(sitting.exam._id, args.assets);
});
