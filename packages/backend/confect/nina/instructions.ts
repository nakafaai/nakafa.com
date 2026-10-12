import type { NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import { QueryRunner } from "@repo/backend/confect/_generated/services";
import { registry } from "@repo/backend/confect/nina/capability/registry";
import { NinaGenerationError } from "@repo/backend/confect/nina/failure";
import { readSaid } from "@repo/backend/confect/nina/memory/said";
import { topicsOf } from "@repo/backend/confect/nina/memory/topics";
import { readPageContext } from "@repo/backend/confect/nina/page";
import { offeredCapabilities } from "@repo/backend/confect/nina/policy/capability";
import { formatFocusPrompt } from "@repo/backend/confect/nina/prompt/focus";
import { formatLearnerPrompt } from "@repo/backend/confect/nina/prompt/learner";
import { formatRecalled } from "@repo/backend/confect/nina/prompt/recall";
import { createNinaSystemPrompt } from "@repo/backend/confect/nina/prompt/system";
import { Clock, Effect } from "effect";

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
 * Reads what a turn knows about its learner: the account facts, the portrait,
 * and the memories that the learner's own words and the open page call up. The
 * words are read from the turn's message, one document beside the thread read
 * that builds the input.
 */
const readLearner = Effect.fn("nina.instructions.learner")(function* (
  turn: Pick<NinaTurnsDoc, "page" | "promptMessageId" | "userId">
) {
  return yield* (yield* QueryRunner).runQuery(refs.internal.nina.memory.read, {
    now: yield* Clock.currentTimeMillis,
    said: yield* readSaid(turn),
    topics: topicsOf(turn.page),
    userId: turn.userId,
  });
}, Effect.orDie);

/**
 * Reads what a turn's system prompt carries (its question focus, the learner's
 * account facts and portrait, the current page, and the conversation summary)
 * concurrently and assembles Nina's instructions. It also returns what the
 * prompt must not carry: the summary, since history omits the turns it covers;
 * the memories the learner's words call up, which belong with their message and
 * not in the prompt, whose bytes the provider caches; and whether the learner
 * paused memory. The turn reads the pause here once. The capabilities Nina is
 * offered follow from it and from what the turn's page allows
 * (`capabilities`): the prompt describes exactly those, and the turn offers
 * exactly those to the model. Every page allows all of them today
 * (`resolveNinaToolContext`), so only the pause changes the prompt.
 */
export const readInstructions = Effect.fn("nina.instructions")(function* (
  turn: Pick<
    Extract<NinaTurnsDoc, { phase: "active" }>,
    "_id" | "chatId" | "page" | "promptMessageId" | "user" | "userId"
  >,
  url: string
) {
  const { runQuery: query } = yield* QueryRunner;
  const { focus, learner, pageContent, summary } = yield* Effect.all(
    {
      focus: turn.page.nina.focus ? readFocus(turn._id) : Effect.undefined,
      learner: readLearner(turn),
      pageContent: turn.page.needsFetch
        ? readPageContext(url)
        : Effect.undefined,
      summary: query(refs.internal.nina.summaries.read, {
        chatId: turn.chatId,
      }).pipe(Effect.orDie),
    },
    { concurrency: "unbounded" }
  );
  const facts = formatLearnerPrompt({
    portrait: learner.portrait,
    profile: learner.profile,
  });
  const capabilities = offeredCapabilities(registry, {
    memory: !learner.paused,
    nina: turn.page.nina,
  });
  return {
    capabilities,
    instructions: createNinaSystemPrompt({
      capabilities,
      ...(focus === undefined ? {} : { focus }),
      ...(facts === undefined ? {} : { learner: facts }),
      ...(pageContent === undefined ? {} : { pageContent }),
      ...(summary ? { summary: summary.text } : {}),
      userRole: turn.user.role,
    }),
    memories: formatRecalled(learner.recalled),
    paused: learner.paused,
    summary,
  };
});
