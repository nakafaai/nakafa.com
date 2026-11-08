import type { Docs } from "@repo/backend/confect/_generated/docs";
import { grantAward } from "@repo/backend/confect/island/award";
import { Effect, Option } from "effect";

/**
 * Grants the island's Stars for a try-out section the learner closed with at
 * least one answer and, when it closed the set's last section with answers in
 * the set, for the set (ADR 0042, D9). It runs in the transaction that closes
 * the section, so a section never closes without its grant, and the keys keep
 * a repeated attempt of the same set from granting again.
 */
export const grantFinishAwards = Effect.fn("tryouts.runtime.grantFinishAwards")(
  function* (
    attempt: Docs["tryoutAttempts"],
    closed: {
      readonly sectionAnswered: number;
      readonly sectionKey: string;
      readonly setAnswered: Option.Option<number>;
    }
  ) {
    if (closed.sectionAnswered > 0) {
      yield* grantAward(attempt.userId, {
        _tag: "section",
        section: closed.sectionKey,
        set: attempt.setIdentity,
      });
    }
    if (Option.exists(closed.setAnswered, (answered) => answered > 0)) {
      yield* grantAward(attempt.userId, {
        _tag: "set",
        set: attempt.setIdentity,
      });
    }
  }
);
