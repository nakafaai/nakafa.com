import { Ref } from "@confect/core";
import { listMessages, listStreams } from "@convex-dev/agent";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { PostHog } from "@posthog/convex";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import { provider } from "@repo/backend/test/gateway";
import { createNinaTest, ninaStream, ninaUsage } from "@repo/backend/test/nina";
import { MockLanguageModelV4 } from "ai/test";
import { Array as Arr } from "effect";

vi.mock("@repo/backend/confect/gateway/live", async () => ({
  GatewayLive: (await import("@repo/backend/test/gateway")).GatewayTest,
}));

const run = Ref.getFunctionReference(refs.internal.nina.response.run);
const cancel = Ref.getFunctionReference(refs.public.nina.lifecycle.cancel);

/** A model whose call stays silent until `release` is called, like a long thought. */
function silentModel() {
  let release: () => void = () => undefined;
  let markStarted: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const model = new MockLanguageModelV4({
    doStream: async () => {
      markStarted();
      await gate;
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
  return { model, release, started };
}

describe("Nina response run", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    provider.languageModel.mockReset();
  });

  // The run asks about its turn once a second, so this test waits in real time
  // and gets a longer limit than the default.
  it("stops a silent provider call when the learner cancels, and pays back only after the run exits", async () => {
    const report = vi
      .spyOn(PostHog.prototype, "captureException")
      .mockResolvedValue(undefined);
    const { model, release, started } = silentModel();
    provider.languageModel.mockReturnValue(model);
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
    try {
      const running = f.t.action(run, { turnId: f.turnId });
      await started;
      expect((await inspect()).streams).toEqual([
        expect.objectContaining({ status: "streaming" }),
      ]);

      await f.owner.mutation(cancel, { chatId: f.chatId });
      const stopping = await inspect();
      expect(stopping.turn?.state.status).toBe("running");
      expect(stopping.user?.credits).toBe(5);
      expect(stopping.chat?.activeTurnId).toBe(f.turnId);
      expect(stopping.streams).toEqual([
        expect.objectContaining({ status: "aborted" }),
      ]);

      // The model never answered. The run still ends: its watch aborts it.
      await running;
      const stopped = await inspect();
      expect(stopped.turn?.state.status).toBe("cancelled");
      expect(stopped.user?.credits).toBe(10);
      expect(stopped.chat?.activeTurnId).toBeUndefined();
      expect(
        Arr.filter(stopped.ledger, (row) => row.type === "refund")
      ).toHaveLength(1);
      expect(
        Arr.some(
          stopped.messages.page,
          (message) =>
            message.message?.role === "assistant" &&
            message.status === "success"
        )
      ).toBe(false);
      // A stop the learner asked for is not an operational failure.
      expect(report).not.toHaveBeenCalled();
    } finally {
      release();
    }
  }, 15_000);
});
