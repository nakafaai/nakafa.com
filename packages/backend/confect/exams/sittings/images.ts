import type {
  ExamAssetsDoc,
  ExamSittingsDoc,
} from "@repo/backend/confect/_generated/docs";
import { rules } from "@repo/backend/confect/assessment/gate/rules";
import { addressesOf } from "@repo/backend/confect/exams/addresses";
import {
  heldSection,
  sectionOf,
  sittingGate,
} from "@repo/backend/confect/exams/sittings/gate";
import { toSittingError } from "@repo/backend/confect/exams/sittings/refusal";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { Effect, Option } from "effect";

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
  const member = yield* Member;
  const section = yield* heldSection(args.sittingId, member);
  const { live } = yield* sittingGate
    .admit(
      rules.paper,
      Option.some(member.person._id),
      Option.some(args.deviceId),
      sectionOf(section)
    )
    .pipe(
      Effect.catchTag("AttemptRefused", (refusal) =>
        Effect.fail(toSittingError(refusal))
      )
    );
  return yield* addressesOf(live.sitting.exam._id, args.assets);
});
