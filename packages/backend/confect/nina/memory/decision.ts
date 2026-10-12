import type { NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import { QueryRunner } from "@repo/backend/confect/_generated/services";
import { judge } from "@repo/backend/confect/nina/judgment/ask";
import { noteText } from "@repo/backend/confect/nina/judgment/note";
import { judgmentFailure } from "@repo/backend/confect/nina/memory/failure";
import {
  MEMORY_CAPTURE_LIMIT,
  type NinaMemoryCandidate,
} from "@repo/backend/confect/nina/memory.spec";
import { Array as Arr, Effect, String as Str } from "effect";

/**
 * Whether the capture call is worth making for a message: it has a character
 * besides whitespace, memory is on, and a decision model finds something in the
 * message that will still matter in later study sessions (`judgment/catalog`).
 * A paused learner's message goes to no model, and a decision that cannot be
 * made fails with the typed error, so that the capture saves nothing for the
 * turn. The pause is read here once, before any model, and the capture write
 * reads it again as the authority, because a learner may pause while the models
 * read.
 */
export const isLasting = Effect.fn("nina.memory.lasting")(function* (
  userId: NinaTurnsDoc["userId"],
  message: string
) {
  if (Str.isEmpty(Str.trim(message))) {
    return false;
  }
  const paused = yield* (yield* QueryRunner)
    .runQuery(refs.internal.nina.memory.paused, { userId })
    .pipe(Effect.orDie);
  if (paused) {
    return false;
  }
  const verdict = yield* judge(["lasting"], message).pipe(
    Effect.mapError(judgmentFailure)
  );
  return verdict.lasting;
});

/**
 * Keeps the candidates that the decision model finds are the learner's own
 * note (a sentence in the learner's voice and language, not a description of
 * the learner from outside) and finds nothing private in. It judges each
 * candidate as its sentence with its quote (`noteText`), both judgments about a
 * candidate in one request. Each candidate is a request of its own, because the
 * model separates notes better when it reads one alone (ADR 0022), and the
 * requests run at the same time. A capture proposes at most
 * `MEMORY_CAPTURE_LIMIT` candidates, which is also the most requests in flight.
 * The candidates that stay keep the order in which the capture model proposed
 * them, whichever request answers first, because the write settles a memory with
 * the first candidate that names it (`memory/write`). A decision that cannot be
 * made fails with the typed error, and the requests that are still open end, so
 * that none of the candidates is kept.
 */
export const judgeCandidates = Effect.fn("nina.memory.judgeCandidates")(
  function* <
    Candidate extends Pick<typeof NinaMemoryCandidate.Type, "quote" | "text">,
  >(candidates: readonly Candidate[]) {
    // `forEach` gives the verdicts in the order of the candidates. `filter` would
    // keep a candidate when its own request answers, so a faster request would
    // put its candidate first.
    const verdicts = yield* Effect.forEach(
      candidates,
      (candidate) => judge(["ownNote", "private"], noteText(candidate)),
      { concurrency: MEMORY_CAPTURE_LIMIT }
    ).pipe(Effect.mapError(judgmentFailure));
    return Arr.map(
      Arr.filter(
        Arr.zip(candidates, verdicts),
        ([, verdict]) => verdict.ownNote && !verdict.private
      ),
      ([candidate]) => candidate
    );
  }
);
