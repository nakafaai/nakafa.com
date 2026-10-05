import type { NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import { QueryRunner } from "@repo/backend/confect/_generated/services";
import type { NinaRuntime } from "@repo/backend/confect/nina/contract/turn";
import { NinaGenerationError } from "@repo/backend/confect/nina/failure";
import { readPageContext } from "@repo/backend/confect/nina/page";
import { formatFocusPrompt } from "@repo/backend/confect/nina/prompt/focus";
import { formatLearnerPrompt } from "@repo/backend/confect/nina/prompt/learner";
import { createNinaSystemPrompt } from "@repo/backend/confect/nina/prompt/system";
import { Effect } from "effect";

/** A focused turn never answers without its rechecked, signed question. */
const readFocus = Effect.fn("nina.instructions.focus")(
  function* (turnId: NinaTurnsDoc["_id"]) {
    const source = yield* (yield* QueryRunner).runQuery(
      refs.internal.nina.focus.read,
      {
        turnId,
      }
    );
    if (!source) {
      return yield* new NinaGenerationError({ reason: "unknown" });
    }
    return yield* formatFocusPrompt(source);
  },
  Effect.mapError(() => new NinaGenerationError({ reason: "unknown" }))
);

/**
 * Reads what a turn's system prompt carries (its question focus, the learner,
 * the current page, and the conversation summary) concurrently and assembles
 * Nina's instructions. The summary also returns, since history omits the turns
 * it covers.
 */
export const readInstructions = Effect.fn("nina.instructions")(function* (
  turn: Pick<
    Extract<NinaTurnsDoc, { phase: "active" }>,
    "_id" | "chatId" | "page" | "user" | "userId"
  >,
  url: string,
  runtime: NinaRuntime
) {
  const { runQuery: query } = yield* QueryRunner;
  const { focus, learner, pageContent, summary } = yield* Effect.all(
    {
      focus: turn.page.nina.focus ? readFocus(turn._id) : Effect.undefined,
      learner: query(refs.internal.nina.memory.read, {
        userId: turn.userId,
      }).pipe(
        Effect.map(({ memory, profile }) =>
          formatLearnerPrompt({ facts: memory?.facts ?? [], profile })
        ),
        Effect.orDie
      ),
      pageContent: turn.page.needsFetch
        ? readPageContext(url)
        : Effect.undefined,
      summary: query(refs.internal.nina.summaries.read, {
        chatId: turn.chatId,
      }).pipe(Effect.orDie),
    },
    { concurrency: "unbounded" }
  );
  return {
    instructions: createNinaSystemPrompt({
      ...(focus === undefined ? {} : { focus }),
      ...(learner === undefined ? {} : { learner }),
      ...(pageContent === undefined ? {} : { pageContent }),
      ...(summary ? { summary: summary.text } : {}),
      page: turn.page,
      user: turn.user,
      runtime,
    }),
    summary,
  };
});
