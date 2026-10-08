import { Agent } from "@convex-dev/agent";
import { components } from "@repo/backend/confect/_generated/components";
import type { NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  ActionCtx,
  MutationRunner,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import { Gateway } from "@repo/backend/confect/gateway/handle";
import { defaultModel } from "@repo/backend/confect/gateway/model";
import { boundText } from "@repo/backend/confect/nina/budget";
import { createEffectSchema } from "@repo/backend/confect/nina/contract/sdk";
import {
  type NinaLearner,
  NinaMemoryChanges,
} from "@repo/backend/confect/nina/memory.spec";
import { formatLearnerProfile } from "@repo/backend/confect/nina/prompt/learner";
import { Output } from "ai";
import { Array as Arr, Effect, Schema } from "effect";

/** Learner text one curation reads. */
const MESSAGE_TOKENS = 1000;

const INSTRUCTIONS = Arr.join(
  [
    "You keep the long-term memory that Nina, Nakafa's AI tutor, holds about one learner.",
    "Read the learner's newest message and decide whether it reveals a durable fact that helps Nina teach this learner in later conversations: their grade or level, the exams they target and when, their goals, the subjects or topics they find hard or easy, and how they like to learn.",
    "Record only what the learner states about themself. Never record the question itself, exercise answers, or anything about other people.",
    "Never record sensitive information: health, religion, ethnicity, political views, precise location, contact details, passwords, or financial details.",
    "Most messages reveal nothing durable; then return empty lists.",
    "Use update when the message changes a known fact and forget when the learner contradicts or withdraws one. Never repeat a known fact or an account fact.",
    "Write each fact as one short statement in the learner's language, at most 160 characters.",
  ],
  "\n"
);

class NinaMemoryError extends Schema.TaggedError<NinaMemoryError>()(
  "NinaMemoryError",
  { operation: Schema.Literals(["read", "generate"]) }
) {}

/** Lists what curation must not repeat: account facts and keyed known facts. */
function formatKnown(
  profile: typeof NinaLearner.Type.profile,
  facts: readonly { readonly key: number; readonly text: string }[]
) {
  return Arr.join(
    [
      formatLearnerProfile(profile) ?? "Account: none",
      facts.length > 0
        ? Arr.join(
            [
              "Known facts:",
              ...Arr.map(facts, (fact) => `- [${fact.key}] ${fact.text}`),
            ],
            "\n"
          )
        : "Known facts: none",
    ],
    "\n\n"
  );
}

/**
 * Updates the learner's memory from a completed turn while memory is on. A
 * failure keeps the memory unchanged; the turn is already complete.
 */
export const curateMemory = Effect.fn("nina.memory.curate")(
  function* (
    turn: Pick<NinaTurnsDoc, "chatId" | "promptMessageId" | "userId">
  ) {
    const learner = yield* (yield* QueryRunner)
      .runQuery(refs.internal.nina.memory.read, {
        userId: turn.userId,
      })
      .pipe(Effect.orDie);
    const { memory } = learner;
    if (!memory) {
      return;
    }
    const ctx = yield* ActionCtx;
    const [prompt] = yield* Effect.tryPromise({
      try: () =>
        ctx.runQuery(components.nina.messages.getMessagesByIds, {
          messageIds: [turn.promptMessageId],
        }),
      catch: () => new NinaMemoryError({ operation: "read" }),
    });
    const text = prompt?.message?.role === "user" ? prompt.text?.trim() : "";
    if (!text) {
      return;
    }
    const handle = (yield* Gateway).language({
      purpose: "background",
      model: defaultModel,
    });
    const agent = new Agent(components.nina, {
      instructions: `${INSTRUCTIONS}\n\n${formatKnown(learner.profile, memory.facts)}`,
      languageModel: handle.model,
      name: "memory",
    });
    const { output, usage } = yield* Effect.tryPromise({
      try: (signal) =>
        agent.generateText(
          ctx,
          { userId: turn.userId },
          {
            abortSignal: signal,
            output: Output.object({
              schema: createEffectSchema(NinaMemoryChanges),
            }),
            prompt: `# Learner Message\n\n${boundText(text, MESSAGE_TOKENS, "Message shortened.")}`,
            timeout: handle.timeout,
          },
          { storageOptions: { saveMessages: "none" } }
        ),
      catch: () => new NinaMemoryError({ operation: "generate" }),
    });
    yield* (yield* MutationRunner)
      .runMutation(refs.internal.nina.memory.apply, {
        changes: output,
        chatId: turn.chatId,
        memory: { id: memory.id, revision: memory.revision },
        usage: {
          input: usage.inputTokens ?? 0,
          output: usage.outputTokens ?? 0,
        },
        userId: turn.userId,
      })
      .pipe(Effect.orDie);
  },
  Effect.catchTag("NinaMemoryError", (error) =>
    Effect.logWarning("Nina memory unavailable", {
      operation: error.operation,
    })
  )
);
