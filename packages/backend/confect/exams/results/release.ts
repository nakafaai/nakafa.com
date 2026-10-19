import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { ResultSitting } from "@repo/backend/confect/exams/results/access";
import { resultAuthority } from "@repo/backend/confect/exams/results/authority";
import { SittingNotClosed } from "@repo/backend/confect/exams/results/errors";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { Clock, Effect } from "effect";

/**
 * Releases a closed sitting's results to its students. The release is journaled under the sitting, with
 * the Person who released it as the actor. A second release changes nothing and writes no second entry,
 * so the journal holds one release for each sitting.
 */
export const release = Effect.fn("exams.results.release")(function* () {
  const sitting = yield* ResultSitting;
  const member = yield* Member;
  if (sitting.state !== "closed") {
    return yield* new SittingNotClosed();
  }
  if (sitting.resultsReleasedAt !== undefined) {
    return null;
  }
  const now = yield* Clock.currentTimeMillis;
  yield* (yield* DatabaseWriter)
    .table("examSittings")
    .patch(sitting._id, {
      resultsReleasedAt: now,
      resultsReleasedBy: member.person._id,
    })
    .pipe(Effect.orDie);
  yield* resultAuthority.record(personActor(member.person), sitting, {
    type: "exam.results.released",
  });
  return null;
});
