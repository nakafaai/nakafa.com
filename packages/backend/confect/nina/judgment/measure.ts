import type { GatewayFailure } from "@repo/backend/confect/gateway/failure";
import { probabilities } from "@repo/backend/confect/nina/judgment/ask";
import type { JudgmentName } from "@repo/backend/confect/nina/judgment/catalog";
import { Effect, Result } from "effect";

/** Requests asked at once, so that a measuring run is gentle on the gateway. */
export const REQUESTS_IN_FLIGHT = 4;

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
 * The probability of every named judgment for one text, or the failure of its
 * request. The text is one request, as production asks it: the named judgments
 * about it together.
 */
const measureText = Effect.fn("nina.judgment.measureText")(function* (
  names: readonly [JudgmentName, ...JudgmentName[]],
  text: string
) {
  const asked = yield* Effect.result(probabilities(names, text));
  return Result.match(asked, {
    onFailure: failed,
    onSuccess: (row) => ({ probabilities: row }),
  });
});

/**
 * Measures the named judgments on some texts: for each text, in the order
 * given, the probability that every named judgment gives, or the routing facts
 * of the failure that kept it from giving one. Each text is a request of its
 * own, as production asks it, and `REQUESTS_IN_FLIGHT` of them run at a time.
 * This is how the thresholds of `judgment/catalog` are set from a labelled set
 * (`judgment:measure`); no production path reads these numbers.
 */
export const measureTexts = Effect.fn("nina.judgment.measureTexts")(function* (
  names: readonly [JudgmentName, ...JudgmentName[]],
  texts: readonly string[]
) {
  return yield* Effect.forEach(texts, (text) => measureText(names, text), {
    concurrency: REQUESTS_IN_FLIGHT,
  });
});
