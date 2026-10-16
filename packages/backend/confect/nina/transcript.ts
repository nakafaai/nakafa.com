import type { MessageDoc } from "@convex-dev/agent";
import {
  boundText,
  countTextTokens,
  NINA_BUDGET,
} from "@repo/backend/confect/nina/budget";
import { storedTurn } from "@repo/backend/confect/nina/uncovered";
import { Array as Arr, pipe, Result } from "effect";

/**
 * The learner and Nina text of one stored turn, oldest message first, from the
 * messages of a read. A message that holds a tool call or a tool result is left
 * out, so Nina's words are her answers. Each message is bounded for the fold.
 */
function turnText(docs: readonly MessageDoc[], order: number) {
  return pipe(
    storedTurn(docs, order),
    Arr.filterMap((doc) =>
      doc.tool || !doc.text
        ? Result.failVoid
        : Result.succeed(
            `${doc.message?.role === "user" ? "Learner" : "Nina"}: ${boundText(doc.text, NINA_BUDGET.foldMessage, "Message shortened.")}`
          )
    ),
    Arr.join("\n\n")
  );
}

/**
 * The turns at `orders`, oldest first, each with the text the writer reads of it
 * and what that text costs in model tokens.
 */
export function foldedTurns(
  docs: readonly MessageDoc[],
  orders: readonly number[]
) {
  return Arr.map(orders, (order) => {
    const text = turnText(docs, order);
    return { order, text, tokens: countTextTokens(text) };
  });
}

/** The transcript of folded turns: their texts, oldest first, without a turn that has no text. */
export function transcriptOf(folded: ReturnType<typeof foldedTurns>) {
  return pipe(
    folded,
    Arr.map(({ text }) => text),
    Arr.filter((text) => text !== ""),
    Arr.join("\n\n")
  );
}
