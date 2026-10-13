import type { NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import { QueryRunner } from "@repo/backend/confect/_generated/services";
import { registry } from "@repo/backend/confect/nina/capability/registry";
import { NinaGenerationError } from "@repo/backend/confect/nina/failure";
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
 * Reads the brief of a turn (`nina/brief`): what the turn knows about its
 * learner (the account facts, the portrait, and the memories that the learner's
 * own words and the open page call up), the chat's summary, and the turns the
 * summary does not cover. One query reads the learner's words beside the rest.
 */
const readBrief = Effect.fn("nina.instructions.brief")(function* (
  turn: Pick<
    NinaTurnsDoc,
    "chatId" | "order" | "page" | "promptMessageId" | "userId"
  >
) {
  return yield* (yield* QueryRunner).runQuery(refs.internal.nina.brief.read, {
    chatId: turn.chatId,
    now: yield* Clock.currentTimeMillis,
    order: turn.order,
    promptMessageId: turn.promptMessageId,
    topics: topicsOf(turn.page),
    userId: turn.userId,
  });
}, Effect.orDie);

/**
 * Reads what a turn's system prompt carries (its question focus, the learner's
 * account facts and portrait, the current page, and the conversation summary)
 * concurrently and assembles Nina's instructions. It also returns what the
 * prompt must not carry: the summary, since history omits the turns it covers;
 * the turns it does not cover, which the history is built from; the memories
 * the learner's words call up, which belong with their message and not in the
 * prompt, whose bytes the provider caches; and whether the learner paused
 * memory. The turn reads the pause here once. The capabilities Nina is offered
 * follow from it and from what the turn's page allows (`capabilities`): the
 * prompt describes exactly those, and the turn offers exactly those to the
 * model. Every page allows all of them today (`resolveNinaToolContext`), so
 * only the pause changes the prompt.
 */
export const readInstructions = Effect.fn("nina.instructions")(function* (
  turn: Pick<
    Extract<NinaTurnsDoc, { phase: "active" }>,
    "_id" | "chatId" | "order" | "page" | "promptMessageId" | "user" | "userId"
  >,
  url: string
) {
  const { brief, focus, pageContent } = yield* Effect.all(
    {
      brief: readBrief(turn),
      focus: turn.page.nina.focus ? readFocus(turn._id) : Effect.undefined,
      pageContent: turn.page.needsFetch
        ? readPageContext(url)
        : Effect.undefined,
    },
    { concurrency: "unbounded" }
  );
  const { learner, summary, uncovered } = brief;
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
    uncovered,
  };
});
