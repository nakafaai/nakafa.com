import { Ref } from "@confect/core";
import { listMessages, listStreams } from "@convex-dev/agent";
import { describe, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import { provider } from "@repo/backend/test/gateway";
import { createNinaTest, ninaStream, ninaUsage } from "@repo/backend/test/nina";
import { MockLanguageModelV4 } from "ai/test";

vi.mock("@repo/backend/confect/gateway/live", async () => ({
  GatewayLive: (await import("@repo/backend/test/gateway")).GatewayTest,
}));

const run = Ref.getFunctionReference(refs.internal.nina.response.run);
const cancel = Ref.getFunctionReference(refs.public.nina.lifecycle.cancel);

describe("probe", () => {
  it("cancel while the model call is in flight", async () => {
    vi.useRealTimers();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started!: () => void;
    const hasStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    let calls = 0;
    const model = new MockLanguageModelV4({
      doStream: async () => {
        calls += 1;
        started();
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
    provider.languageModel.mockReturnValue(model);
    const f = await createNinaTest({ prompt: "Explain a function limit." });
    const log: string[] = [];
    const snapshot = async () =>
      f.t.query(async (ctx) => ({
        streams: await listStreams(ctx, components.nina, {
          threadId: f.threadId,
          includeStatuses: ["streaming", "finished", "aborted"],
        }),
        messages: await listMessages(ctx, components.nina, {
          threadId: f.threadId,
          paginationOpts: { cursor: null, numItems: 20 },
        }),
        turn: await ctx.db.get("ninaTurns", f.turnId),
        user: await ctx.db.get("users", f.identity.userId),
      }));
    const running = f.t.action(run, { turnId: f.turnId });
    await hasStarted;
    const before = await snapshot();
    log.push([
      "BEFORE CANCEL streams:",
      JSON.stringify(before.streams.map((s) => [s.status, s.order, s.stepOrder])),
      "messages:",
      JSON.stringify(
        before.messages.page.map((m) => [m.order, m.stepOrder, m.status, m.message?.role])
      ),
      "turn:",
      before.turn?.state.status
    ].join(' '));
    await f.owner.mutation(cancel, { chatId: f.chatId });
    const mid = await snapshot();
    log.push([
      "AFTER CANCEL streams:",
      JSON.stringify(mid.streams.map((s) => [s.status, s.order, s.stepOrder])),
      "turn:",
      mid.turn?.state.status,
      "credits:",
      mid.user?.credits
    );
    release();
    await running;
    const after = await snapshot();
    log.push([
      "AFTER ACTION streams:",
      JSON.stringify(after.streams.map((s) => [s.status, s.order, s.stepOrder])),
      "messages:",
      JSON.stringify(
        after.messages.page.map((m) => [m.order, m.stepOrder, m.status, m.message?.role])
      ),
      "turn:",
      JSON.stringify(after.turn?.state),
      "credits:",
      after.user?.credits,
      "doStream calls:",
      calls
    );
  });
});
