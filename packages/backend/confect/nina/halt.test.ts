import { Ref } from "@confect/core";
import { listMessages } from "@convex-dev/agent";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { PostHog } from "@posthog/convex";
import refs from "@repo/backend/confect/_generated/refs";
import { resolveNinaContext } from "@repo/backend/confect/nina/context";
import { provider } from "@repo/backend/test/gateway";
import { ninaModel } from "@repo/backend/test/nina";
import { args, contextFor, start } from "@repo/backend/test/nina/admission";
import { createSilentTest, hasAnswer } from "@repo/backend/test/nina/silent";
import { Array as Arr } from "effect";

vi.mock("@repo/backend/confect/gateway/live", async () => ({
  GatewayLive: (await import("@repo/backend/test/gateway")).GatewayTest,
}));

vi.mock("@convex-dev/agent", async (load) => {
  const actual = await load<typeof import("@convex-dev/agent")>();
  return { ...actual, listMessages: vi.fn(actual.listMessages) };
});

// Admission freezes the page facts of a prompt; the stop and resend test needs
// no signed content for them.
vi.mock("@repo/backend/confect/nina/context", () => ({
  resolveNinaContext: vi.fn(),
}));

const run = Ref.getFunctionReference(refs.internal.nina.response.run);
const cancel = Ref.getFunctionReference(refs.public.nina.lifecycle.cancel);

describe("A running Nina turn that the learner stops", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    provider.languageModel.mockReset();
  });

  it("answers the turn sent right after a stop while the stopped run still winds down, and the late exit changes nothing", async () => {
    vi.mocked(resolveNinaContext).mockReturnValue(contextFor("home"));
    const f = await createSilentTest();
    try {
      const { running } = await f.begin();
      await f.owner.mutation(cancel, { chatId: f.chatId });

      // The next prompt settles the stopped turn and queues its own, and that
      // turn's run needs neither the stopped run to end nor a sweep.
      provider.languageModel.mockReturnValue(ninaModel());
      const next = Ref.decodeReturnsSync(
        refs.public.nina.turns.start,
        await f.owner.mutation(start, {
          ...args,
          chatId: f.chatId,
          requestId: "next",
        })
      );
      await f.t.action(run, { turnId: next.turnId });
      const answered = await f.t.query((ctx) =>
        ctx.db.get("ninaTurns", next.turnId)
      );
      expect(answered?.state.status).toBe("complete");

      // The stopped run exits later and finds its turn settled.
      f.release();
      await running;
      const state = await f.inspect();
      expect(state.turn?.state.status).toBe("cancelled");
      expect(state.chat?.activeTurnId).toBeUndefined();
      expect(state.user?.credits).toBe(5);
      expect(
        Arr.filter(state.ledger, (row) => row.type === "refund")
      ).toHaveLength(1);
    } finally {
      f.release();
    }
  }, 30_000);

  // The run asks about its turn once a second, so these tests wait in real time
  // and get a longer limit than the default.
  it("stops a silent provider call when the learner cancels, and pays back only after the run exits", async () => {
    const report = vi
      .spyOn(PostHog.prototype, "captureException")
      .mockResolvedValue(undefined);
    const f = await createSilentTest();
    try {
      const { running } = await f.begin();

      await f.owner.mutation(cancel, { chatId: f.chatId });
      const stopping = await f.inspect();
      expect(stopping.turn?.state.status).toBe("running");
      expect(stopping.user?.credits).toBe(5);
      expect(stopping.chat?.activeTurnId).toBe(f.turnId);
      expect(stopping.streams).toEqual([
        expect.objectContaining({ status: "aborted" }),
      ]);

      // The model never answered. The run still ends: its watch aborts it.
      await running;
      const stopped = await f.inspect();
      expect(stopped.turn?.state.status).toBe("cancelled");
      expect(stopped.user?.credits).toBe(10);
      expect(stopped.chat?.activeTurnId).toBeUndefined();
      expect(
        Arr.filter(stopped.ledger, (row) => row.type === "refund")
      ).toHaveLength(1);
      // It keeps the stages its run reached before the stop: the run took the
      // turn and was about to call the model, and nothing came back.
      expect(stopped.turn?.timing).toEqual({
        claimedMs: expect.any(Number),
        readyMs: expect.any(Number),
      });
      expect(hasAnswer(stopped.messages)).toBe(false);
      // A stop the learner asked for is not an operational failure.
      expect(report).not.toHaveBeenCalled();
    } finally {
      f.release();
    }
  }, 15_000);

  it("does not report a stop that Agent noticed before the watch did", async () => {
    const report = vi
      .spyOn(PostHog.prototype, "captureException")
      .mockResolvedValue(undefined);
    const f = await createSilentTest();
    try {
      const running = f.t.action(run, { turnId: f.turnId });
      await f.reachesModel(running);
      // The stream is not open yet. Agent finds it stopped when it opens it and
      // ends the generation itself, ahead of the watch's next check.
      await f.owner.mutation(cancel, { chatId: f.chatId });
      await running;

      const stopped = await f.inspect();
      expect(stopped.turn?.state.status).toBe("cancelled");
      expect(stopped.user?.credits).toBe(10);
      expect(hasAnswer(stopped.messages)).toBe(false);
      expect(report).not.toHaveBeenCalled();
    } finally {
      f.release();
    }
  }, 15_000);

  it("reports a settlement that failed after the learner stopped the turn", async () => {
    const report = vi
      .spyOn(PostHog.prototype, "captureException")
      .mockResolvedValue(undefined);
    const f = await createSilentTest();
    const actual =
      await vi.importActual<typeof import("@convex-dev/agent")>(
        "@convex-dev/agent"
      );
    try {
      const { running } = await f.begin();
      // The stop reads the journal once and succeeds. The settlement that the
      // run's exit makes reads it next, and that read fails.
      vi.mocked(listMessages)
        .mockImplementationOnce(actual.listMessages)
        .mockRejectedValueOnce(new Error("Private component failure"));
      await f.owner.mutation(cancel, { chatId: f.chatId });
      await running;

      // The learner's stop hides nothing about the settlement that was lost.
      expect(report).toHaveBeenCalledOnce();
      const stuck = await f.inspect();
      expect(stuck.turn).toMatchObject({
        phase: "active",
        state: { status: "running" },
        cancelRequestedAt: expect.any(Number),
      });
      expect(stuck.user?.credits).toBe(5);
      expect(stuck.chat?.activeTurnId).toBe(f.turnId);
    } finally {
      f.release();
    }
  }, 15_000);
});
