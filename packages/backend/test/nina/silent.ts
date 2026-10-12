import { Ref } from "@confect/core";
import { listMessages, listStreams } from "@convex-dev/agent";
import { expect } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import { provider } from "@repo/backend/test/gateway";
import { createNinaTest, ninaStream, ninaUsage } from "@repo/backend/test/nina";
import { MockLanguageModelV4 } from "ai/test";
import { Array as Arr, Deferred, Effect } from "effect";

const run = Ref.getFunctionReference(refs.internal.nina.response.run);

/** A model whose call stays silent until `release` is called, like a long thought. */
function silentModel() {
  const gate = Deferred.makeUnsafe<void>();
  const begun = Deferred.makeUnsafe<void>();
  const model = new MockLanguageModelV4({
    doStream: async () => {
      Deferred.doneUnsafe(begun, Effect.void);
      await Effect.runPromise(Deferred.await(gate));
      return ninaStream([
        { type: "stream-start", warnings: [] },
        { type: "text-start", id: "answer" },
        { type: "text-delta", id: "answer", delta: "A late answer." },
        { type: "text-end", id: "answer" },
        {
          type: "finish",
          usage: ninaUsage,
          finishReason: { unified: "stop", raw: "stop" },
        },
      ]);
    },
  });
  return {
    model,
    release: () => {
      Deferred.doneUnsafe(gate, Effect.void);
    },
    started: Effect.runPromise(Deferred.await(begun)),
  };
}

/** A turn whose model is silent, with a reader of everything a run settles. */
export async function createSilentTest() {
  const silent = silentModel();
  provider.languageModel.mockReturnValue(silent.model);
  const f = await createNinaTest({ prompt: "Explain a function limit." });
  const inspect = () =>
    f.t.query(async (ctx) => ({
      user: await ctx.db.get("users", f.identity.userId),
      turn: await ctx.db.get("ninaTurns", f.turnId),
      chat: await ctx.db.get("chats", f.chatId),
      ledger: await ctx.db.query("creditTransactions").collect(),
      streams: await listStreams(ctx, components.nina, {
        threadId: f.threadId,
        includeStatuses: ["streaming", "finished", "aborted"],
      }),
      messages: await listMessages(ctx, components.nina, {
        threadId: f.threadId,
        paginationOpts: { cursor: null, numItems: 20 },
      }),
    }));
  /**
   * Waits until the run has called the model. A run that ends before it does,
   * by returning or by failing, ends the test with that outcome, not with a
   * timeout.
   */
  const reachesModel = async (running: Promise<unknown>) => {
    const called = await Promise.race([
      silent.started.then(() => true),
      running.then(() => false),
    ]);
    expect(called, "the run ended before it called the model").toBe(true);
  };
  /** Starts the run and waits until its model call is in flight and its stream is open. */
  const begin = async () => {
    const running = f.t.action(run, { turnId: f.turnId });
    await reachesModel(running);
    expect((await inspect()).streams).toEqual([
      expect.objectContaining({ status: "streaming" }),
    ]);
    return { running };
  };
  return { ...f, ...silent, inspect, begin, reachesModel };
}

/** True when the thread holds an assistant message that counts as an answer. */
export function hasAnswer(messages: Awaited<ReturnType<typeof listMessages>>) {
  return Arr.some(
    messages.page,
    (message) =>
      message.message?.role === "assistant" && message.status === "success"
  );
}
