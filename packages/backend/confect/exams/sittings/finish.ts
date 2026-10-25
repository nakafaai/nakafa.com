import type { ExamSittingsDoc } from "@repo/backend/confect/_generated/docs";
import {
  heldSection,
  sittingGate,
} from "@repo/backend/confect/exams/sittings/gate";
import { toSittingError } from "@repo/backend/confect/exams/sittings/refusal";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { Effect, Option } from "effect";

/**
 * The student's Finish: the caller's attempt is submitted now, and its pending close is
 * cancelled, so the submission is the student's own. A second Finish changes nothing and
 * answers the same. The gate admits the write and the journal records the submission under
 * the student's Person (ADR 0013, ADR 0016).
 */
export const finish = Effect.fn("exams.sittings.finish")(function* (args: {
  deviceId: string;
  sittingId: ExamSittingsDoc["_id"];
}) {
  const member = yield* Member;
  const section = yield* heldSection(args.sittingId, member);
  yield* sittingGate
    .finish({
      device: Option.some(args.deviceId),
      owner: member.person._id,
      section,
      settled: "answer",
    })
    .pipe(
      Effect.catchTag("AttemptRefused", (refusal) =>
        Effect.fail(toSittingError(refusal))
      )
    );
  return null;
});
