import type { NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import {
  createNinaAgentContext,
  readNinaLearningPage,
} from "@repo/backend/confect/nina/contract/turn";
import { readInput } from "@repo/backend/confect/nina/input";
import { readInstructions } from "@repo/backend/confect/nina/instructions";
import { formatTurnContext } from "@repo/backend/confect/nina/prompt/runtime";
import { DateTime, Effect } from "effect";

/**
 * Reads everything a run needs before it calls the model: Nina's instructions
 * and the capabilities she is offered, the context of her tools, the model
 * input of the turn, and what its history cost, which the turn stores. The turn
 * reads once whether the learner paused memory, and
 * the prompt, the tools Nina is offered and the policy of each call all follow
 * it. What the run reads of the learner and the chat comes from one query (the
 * brief, `nina/brief`), and the thread's messages follow it, so a short chat
 * costs two calls and a long one a call for each page more.
 */
export const prepareTurn = Effect.fn("nina.prepare")(function* (
  turn: Extract<NinaTurnsDoc, { phase: "active" }>
) {
  const runtime = {
    currentDate: DateTime.formatIso(DateTime.makeUnsafe(turn._creationTime)),
  };
  const { capabilities, instructions, memories, paused, summary, uncovered } =
    yield* readInstructions(turn, readNinaLearningPage(turn.page).url);
  const context = createNinaAgentContext({
    memory: !paused,
    page: turn.page,
    user: turn.user,
    runtime,
  });
  // Nina reads its own turns, so the Agent fetches no history and sends this as is.
  const { history, input } = yield* readInput(turn, {
    context: formatTurnContext({
      memories,
      page: turn.page,
      runtime,
      user: turn.user,
    }),
    through: summary?.throughOrder ?? null,
    uncovered,
  });
  return { capabilities, context, history, input, instructions };
});
