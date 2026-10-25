import type { ExamSittingsDoc } from "@repo/backend/confect/_generated/docs";
import type { EnterOutcome } from "@repo/backend/confect/exams/sittings/contract";
import { sittingEntry } from "@repo/backend/confect/exams/sittings/gate";
import { toSittingError } from "@repo/backend/confect/exams/sittings/refusal";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { Effect } from "effect";

type EnterReply = typeof EnterOutcome.Type;

/** A refusal of the token or of the tries, which the reply carries as a value. */
const refused = (reason: "TokenRefused" | "TooManyTries"): EnterReply => ({
  outcome: "refused",
  reason,
});

/**
 * Admits a student to a sitting with its token, from one device (ADR 0013). The entry gate
 * decides the order: the student must be in the sitting, its school and unit must not be
 * locked, the sitting or the attempt must be open, and then the device must stand well with
 * the attempt before any token is checked. A token that does not match, or too many tries,
 * is a refused reply, and the failed try it counts stays in the database.
 */
export const enter = Effect.fn("exams.sittings.enter")(function* (args: {
  deviceId: string;
  sittingId: ExamSittingsDoc["_id"];
  token: string;
}) {
  const member = yield* Member;
  return yield* sittingEntry
    .enter({
      device: args.deviceId,
      target: { member, sittingId: args.sittingId },
      token: args.token,
    })
    .pipe(
      Effect.catchTags({
        AttemptRefused: (refusal) => Effect.fail(toSittingError(refusal)),
        TokenRefused: () => Effect.succeed(refused("TokenRefused")),
        TooManyTries: () => Effect.succeed(refused("TooManyTries")),
      })
    );
});
