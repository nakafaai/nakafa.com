import type { NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import { NinaGenerationError } from "@repo/backend/confect/nina/failure";
import { historyCost } from "@repo/backend/confect/nina/fold";
import {
  type Asking,
  assembleContext,
} from "@repo/backend/confect/nina/history";
import { withTurnContext } from "@repo/backend/confect/nina/prompt/user";
import {
  readUncovered,
  turnMessages,
} from "@repo/backend/confect/nina/uncovered";
import { Array as Arr, Effect } from "effect";

const unreadable = () => new NinaGenerationError({ reason: "unknown" });

/**
 * Reads the model input of one turn by turn order, not as the last messages of
 * the thread. The history is the complete turns after the summary, each whole
 * with its question and answer: a cancelled or failed turn leaves no messages
 * behind, and a question the learner asked again shows only its newest
 * asking, whichever of its askings the learner retried. The read stops at the
 * turns the history can hold, or after a long run of replaced askings, and the
 * turns behind such a run wait for the next fold (`readUncovered`). The
 * learner's message carries the turn's runtime facts, which are not stored.
 * `uncovered` is the first page of those turns, when the caller holds it
 * already, as the turn's brief does (`nina/brief`). The result holds the model
 * input and what the history cost (`historyCost`), which the turn stores.
 */
export const readInput = Effect.fn("nina.input.read")(function* (
  turn: Pick<
    NinaTurnsDoc,
    "chatId" | "order" | "promptMessageId" | "retryOf" | "threadId"
  >,
  {
    context,
    through,
    uncovered,
  }: {
    readonly context: string;
    readonly through: number | null;
    readonly uncovered?: readonly Asking[];
  }
) {
  const { docs, turns, unread } = yield* readUncovered(
    turn,
    turn.order,
    through,
    [turn],
    uncovered
  ).pipe(Effect.mapError(unreadable));
  const [question, ...answers] = turnMessages(docs, turn.order);
  if (question?.role !== "user") {
    return yield* unreadable();
  }
  return {
    history: historyCost(turns, unread),
    input: assembleContext({
      current: [withTurnContext(question, context), ...answers],
      history: Arr.map(turns, ({ messages }) => messages),
    }),
  };
});
