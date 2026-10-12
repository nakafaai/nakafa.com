import type { GatewayFailure } from "@repo/backend/confect/gateway/failure";
import { probabilities } from "@repo/backend/confect/nina/judgment/ask";
import type { JudgmentName } from "@repo/backend/confect/nina/judgment/catalog";
import { Array as Arr, Effect, Result } from "effect";

/** Groups of texts asked about at once, so that a measuring run is gentle on the gateway. */
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
 * The probability of every named judgment for each text of one group, or, for
 * each of them, the failure of the request. The group is one request, as
 * production asks it: the named judgments about each of its texts together.
 */
const measureGroup = Effect.fn("nina.judgment.measureGroup")(function* (
  names: readonly [JudgmentName, ...JudgmentName[]],
  group: readonly string[]
) {
  const asked = yield* Effect.result(probabilities(names, group));
  return Result.match(asked, {
    onFailure: (failure) => Arr.map(group, () => failed(failure)),
    onSuccess: (rows) => Arr.map(rows, (row) => ({ probabilities: row })),
  });
});

/**
 * Measures the named judgments on some texts: for each text, in the order
 * given, the probability that every named judgment gives, or the routing facts
 * of the failure that kept it from giving one. `together` texts share a
 * request, and all the named judgments are asked about them in that request, as
 * production does: one message at a time for `lasting`, and the candidates of a
 * turn together for the judgments of a note. This is how the thresholds of
 * `judgment/catalog` are set from a labelled set (`judgment:measure`); no
 * production path reads these numbers.
 */
export const measureTexts = Effect.fn("nina.judgment.measureTexts")(function* (
  names: readonly [JudgmentName, ...JudgmentName[]],
  texts: readonly string[],
  together: number
) {
  return Arr.flatten(
    yield* Effect.forEach(
      Arr.chunksOf(texts, together),
      (group) => measureGroup(names, group),
      { concurrency: GROUPS_IN_FLIGHT }
    )
  );
});
