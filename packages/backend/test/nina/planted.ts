import { Ref } from "@confect/core";
import refs from "@repo/backend/confect/_generated/refs";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { ninaStream, ninaToolInput, ninaUsage } from "@repo/backend/test/nina";
import { storedTextOf } from "@repo/backend/test/nina/stored";
import { encodeJsonText } from "@repo/utilities/json";
import { MockLanguageModelV4 } from "ai/test";
import { Array as Arr, Record } from "effect";

/** The moment the seal tests run at. */
export const NOW = Date.UTC(2026, 8, 27, 12);

/**
 * One text for each place the seal must keep out of the component tables: the
 * learner's message, the reasoning, the answer, a tool input, a tool output and a
 * source (ADR 0024), and the name of the learner's file. Each one is unique, so a
 * search finds only its own place.
 */
export const PLANTED = {
  answer: "planted-answer-5c1e",
  file: "planted-file-4a8c",
  input: "planted-tool-input-3b9d",
  output: "planted-tool-output-8a2f",
  prompt: "planted-prompt-0e7a",
  reasoning: "planted-reasoning-6d4c",
  source: "planted-source-9f21",
};

const start = Ref.getFunctionReference(refs.public.nina.turns.start);

/** The planted texts that a stored value holds, in the order of `PLANTED`. */
export function plantedIn(value: unknown) {
  const text = storedTextOf(value);
  return Arr.filter(Record.values(PLANTED), (planted) =>
    text.includes(planted)
  );
}

/**
 * A model that calls the `nakafa` tool with a planted input, then answers with
 * planted reasoning, a planted answer and a planted source.
 */
export function plantedModel() {
  return new MockLanguageModelV4({
    doStream: [
      ninaStream([
        { type: "stream-start", warnings: [] },
        {
          type: "tool-call",
          toolCallId: "read-1",
          toolName: "nakafa",
          input: encodeJsonText({ ...ninaToolInput, request: PLANTED.input }),
        },
        {
          type: "finish",
          usage: ninaUsage,
          finishReason: { unified: "tool-calls", raw: "tool-calls" },
        },
      ]),
      ninaStream([
        { type: "stream-start", warnings: [] },
        { type: "reasoning-start", id: "reason" },
        { type: "reasoning-delta", id: "reason", delta: PLANTED.reasoning },
        { type: "reasoning-end", id: "reason" },
        { type: "text-start", id: "answer" },
        { type: "text-delta", id: "answer", delta: PLANTED.answer },
        { type: "text-end", id: "answer" },
        {
          type: "source",
          sourceType: "url",
          id: "source-1",
          url: `https://example.com/${PLANTED.source}`,
          title: PLANTED.source,
        },
        {
          type: "finish",
          usage: ninaUsage,
          finishReason: { unified: "stop", raw: "stop" },
        },
      ]),
    ],
  });
}

/**
 * A learner who asks one question through `turns.start`, the admission a learner
 * uses, so the question is sealed as it is in production. The receipt names the
 * chat, the thread, the turn and the prompt.
 */
export async function askedIn(text: string) {
  const t = createConvexTestWithBetterAuth();
  const identity = await t.mutation((ctx) =>
    seedAuthenticatedUser(ctx, { now: NOW, credits: 10 })
  );
  const owner = t.withIdentity({
    subject: identity.authUserId,
    sessionId: identity.sessionId,
  });
  const receipt = Ref.decodeReturnsSync(
    refs.public.nina.turns.start,
    await owner.mutation(start, {
      input: {
        kind: "message",
        page: { locale: "en", slug: "home" },
        prompt: { text },
      },
      requestId: "seal-request",
    })
  );
  const turn = () => t.query((ctx) => ctx.db.get("ninaTurns", receipt.turnId));
  /** When the seal ran, or undefined while the turn is open or still plain. */
  const sealedAt = async () => {
    const found = await turn();
    return found?.phase === "settled" ? found.sealedAt : undefined;
  };
  return { owner, receipt, sealedAt, t, turn, userId: identity.userId };
}
