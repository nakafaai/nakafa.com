import type { GatewayFailure } from "@repo/backend/confect/gateway/failure";
import { probabilities } from "@repo/backend/confect/nina/judgment/ask";
import { judgments } from "@repo/backend/confect/nina/judgment/catalog";
import { Array as Arr, Effect, Record as Rec, Result } from "effect";

/** Groups of texts asked about at once, two requests each, so that a measuring run is gentle on the gateway. */
const GROUPS_IN_FLIGHT = 4;

/** What a failed request tells: its routing facts, and never a text. */
function failed({ reason, status, type }: GatewayFailure) {
  return {
    failure: {
      reason,
      ...(status === undefined ? {} : { status }),
      ...(type === undefined ? {} : { type }),
    },
  };
}

/**
 * The probability of every judgment for each text of one group, or, for each
 * of them, the failure of the first request that failed. Each judgment is one
 * request about the whole group, as production asks it: one text at a time
 * when the group has one, the candidates of a turn together when it has more.
 */
const measureGroup = Effect.fn("nina.judgment.measureGroup")(function* (
  group: readonly string[]
) {
  const asked = yield* Effect.result(
    Effect.forEach(
      Rec.keys(judgments),
      (name) => probabilities([name], group),
      { concurrency: "unbounded" }
    )
  );
  return Result.match(asked, {
    onFailure: (failure) => Arr.map(group, () => failed(failure)),
    onSuccess: (byJudgment) =>
      Arr.map(group, (_, index) => ({
        probabilities: Rec.fromEntries(
          Arr.flatMap(byJudgment, (rows) => Rec.toEntries(rows[index]))
        ),
      })),
  });
});

/**
 * Measures the judgments on some texts: for each text, in the order given, the
 * probability that every judgment gives, or the routing facts of the failure
 * that kept it from giving one. `together` texts share a request, as the
 * candidates of one turn do in production. This is how the thresholds of
 * `judgment/catalog` are set from a labelled set (`judgment:measure`); no
 * production path reads these numbers.
 */
export const measureTexts = Effect.fn("nina.judgment.measureTexts")(function* (
  texts: readonly string[],
  together: number
) {
  return Arr.flatten(
    yield* Effect.forEach(Arr.chunksOf(texts, together), measureGroup, {
      concurrency: GROUPS_IN_FLIGHT,
    })
  );
});
