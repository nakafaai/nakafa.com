import { Ref } from "@confect/core";
import { listMessages, listStreams, saveMessages } from "@convex-dev/agent";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import { readThread } from "@repo/backend/confect/nina/sealed/thread";
import { SealedReadError } from "@repo/backend/confect/nina/sealed.spec";
import { STOP_GRACE, settleTurn } from "@repo/backend/confect/nina/settlement";
import { seedAnalyticsConsent } from "@repo/backend/confect/test.helpers";
import { createNinaTest } from "@repo/backend/test/nina";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Duration, Effect, Option, pipe } from "effect";

vi.mock("@repo/backend/confect/nina/sealed/thread", async (load) => {
  const actual =
    await load<typeof import("@repo/backend/confect/nina/sealed/thread")>();
  return { ...actual, readThread: vi.fn(actual.readThread) };
});
vi.mock("@repo/backend/confect/nina/settlement", async (load) => {
  const actual =
    await load<typeof import("@repo/backend/confect/nina/settlement")>();
  return { ...actual, settleTurn: vi.fn(actual.settleTurn) };
});

const NOW = Date.UTC(2026, 8, 27, 12);
const claim = Ref.getFunctionReference(refs.internal.nina.lifecycle.claim);
const recover = Ref.getFunctionReference(refs.internal.nina.lifecycle.recover);
const cancel = Ref.getFunctionReference(refs.public.nina.lifecycle.cancel);
const record = Ref.getFunctionReference(refs.internal.nina.usage.record);

async function fixture() {
  const seeded = await createNinaTest({ now: NOW });
  const { t, identity, ...saved } = seeded;
  const inspect = () =>
    t.query(async (ctx) => ({
      user: await ctx.db.get("users", identity.userId),
      turn: await ctx.db.get("ninaTurns", saved.turnId),
      chat: await ctx.db.get("chats", saved.chatId),
      ledger: await ctx.db.query("creditTransactions").collect(),
      messages: await listMessages(ctx, components.nina, {
        threadId: saved.threadId,
        paginationOpts: { cursor: null, numItems: 20 },
      }),
    }));
  return { ...seeded, inspect };
}

describe("native Nina settlement", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("claims a queued response once and refunds an interrupted generation exactly once", async () => {
    const f = await fixture();
    await f.t.mutation((ctx) =>
      seedAnalyticsConsent(ctx, { userId: f.identity.userId, decidedAt: NOW })
    );
    const args = { turnId: f.turnId };
    expect(
      Ref.decodeReturnsSync(
        refs.internal.nina.lifecycle.claim,
        await f.t.mutation(claim, args)
      )
    ).toMatchObject({
      state: { status: "running" },
      timing: { claimedMs: expect.any(Number) },
    });
    expect(
      Ref.decodeReturnsSync(
        refs.internal.nina.lifecycle.claim,
        await f.t.mutation(claim, args)
      )
    ).toBeNull();
    await f.t.mutation(recover, args);
    await f.t.mutation(recover, args);
    await f.owner.mutation(cancel, { chatId: f.chatId });
    const state = await f.inspect();
    expect(state.user?.credits).toBe(10);
    expect(state.turn?.state).toMatchObject({
      status: "failed",
      reason: "interrupted",
    });
    expect(state.chat?.activeTurnId).toBeUndefined();
    // A settlement that carries no stages keeps the claim the turn stored.
    expect(state.turn?.timing).toEqual({ claimedMs: expect.any(Number) });
    expect(
      Arr.filter(state.ledger, (row) => row.type === "refund")
    ).toHaveLength(1);
    expect(state.messages.page[0]?.message).toEqual({
      role: "user",
      content: "Explain a limit.",
    });
    const events = await f.t.query((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );
    expect(
      Arr.filter(events, (job) => job.name === "nina/response:present")
    ).toHaveLength(0);
    expect(
      pipe(
        events,
        Arr.filter((job) => job.name.includes("deliverProductEvent")),
        Arr.map((job) => job.args)
      )
    ).toEqual([
      [
        expect.objectContaining({
          event: "chat response failed",
          properties: encodeJsonText({
            chat_type: "study",
            error_code: "interrupted",
          }),
        }),
      ],
    ]);
  });

  it("claims a turn by reading the turn, its learner and its chat once, and the turn one more time to write it", async () => {
    const f = await fixture();
    const metrics = await f.t.mutation(async (ctx) => {
      await ctx.runMutation(claim, { turnId: f.turnId });
      return ctx.meta.getTransactionMetrics();
    });
    // A `patch` of the turn read it once more, which made five.
    expect(metrics.documentsRead.used).toBe(4);
    expect(metrics.documentsWritten.used).toBe(1);
  });

  it("adds the stages a run reached to its claim when the turn settles", async () => {
    const f = await fixture();
    await f.t.mutation(claim, { turnId: f.turnId });
    const timing = { readyMs: 1500, progressMs: 4000, tokenMs: 4200 };
    await f.t.mutation(recover, { turnId: f.turnId, timing });
    expect((await f.inspect()).turn?.timing).toEqual({
      claimedMs: expect.any(Number),
      ...timing,
    });
  });

  it("settles an already committed answer before a concurrent cancel without another debit", async () => {
    const f = await fixture();
    await f.t.mutation((ctx) =>
      seedAnalyticsConsent(ctx, { userId: f.identity.userId, decidedAt: NOW })
    );
    await f.t.mutation(claim, { turnId: f.turnId });
    for (const agent of ["nina", "research", "research", "math-repair"]) {
      await f.t.mutation(record, {
        turnId: f.turnId,
        usage: {
          agent,
          model: "gateway-model",
          provider: "gateway",
          input: 12,
          output: 4,
        },
      });
    }
    await f.t.mutation((ctx) =>
      saveMessages(ctx, components.nina, {
        threadId: f.threadId,
        promptMessageId: f.promptMessageId,
        messages: [{ role: "assistant", content: "The verified limit is 2." }],
        metadata: [{ finishReason: "stop" }],
      })
    );
    await f.owner.mutation(cancel, { chatId: f.chatId });
    // The saved answer wins the race: there is no run left to wait for.
    expect((await f.inspect()).turn?.state.status).toBe("complete");
    await f.t.mutation(recover, { turnId: f.turnId });
    const state = await f.inspect();
    expect(state.turn?.state.status).toBe("complete");
    expect(state.user?.credits).toBe(0);
    expect(state.ledger).toHaveLength(1);
    expect(state.ledger[0]?.metadata).toMatchObject({
      phase: "complete",
      turnId: f.turnId,
    });
    expect(
      Arr.reduce(
        state.turn?.usage ?? [],
        0,
        (sum, row) => sum + row.input + row.output
      )
    ).toBe(64);
    expect(
      Option.getOrUndefined(
        Arr.findFirst(
          state.turn?.usage ?? [],
          (row) => row.agent === "research"
        )
      )
    ).toMatchObject({ calls: 2, input: 24, output: 8 });
    const events = await f.t.query((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );
    expect(
      Arr.filter(events, (job) => job.name === "nina/response:present")
    ).toHaveLength(1);
    expect(
      pipe(
        events,
        Arr.filter((job) => job.name.includes("deliverProductEvent")),
        Arr.map((job) => job.args)
      )
    ).toEqual([
      [
        expect.objectContaining({
          event: "chat response completed",
          properties: encodeJsonText({
            chat_type: "study",
            credits: 10,
            input_tokens: 48,
            output_tokens: 16,
            total_tokens: 64,
          }),
        }),
      ],
    ]);
  });

  it("preserves a cancelled prompt and prevents a late provider answer from becoming successful", async () => {
    const f = await fixture();
    await f.t.mutation(claim, { turnId: f.turnId });
    const streamId = await f.t.mutation((ctx) =>
      ctx.runMutation(components.nina.streams.create, {
        threadId: f.threadId,
        order: 0,
        stepOrder: 1,
        format: "UIMessageChunk",
      })
    );
    await f.owner.mutation(cancel, { chatId: f.chatId });
    await f.t.mutation((ctx) =>
      saveMessages(ctx, components.nina, {
        threadId: f.threadId,
        promptMessageId: f.promptMessageId,
        messages: [{ role: "assistant", content: "Late answer" }],
        metadata: [{ finishReason: "stop" }],
      })
    );
    await f.t.mutation(recover, { turnId: f.turnId });
    const state = await f.inspect();
    expect(state.user?.credits).toBe(10);
    expect(state.turn?.state).toEqual({ status: "cancelled", finishedAt: NOW });
    expect(
      Option.getOrUndefined(
        Arr.findFirst(
          state.messages.page,
          (row) => row.message?.role === "assistant"
        )
      )?.status
    ).toBe("failed");
    const streams = await f.t.query((ctx) =>
      listStreams(ctx, components.nina, {
        threadId: f.threadId,
        includeStatuses: ["aborted"],
      })
    );
    expect(streams).toEqual([
      expect.objectContaining({ streamId, status: "aborted" }),
    ]);
  });

  it("asks a running generation to stop and pays back only after its run has exited", async () => {
    const f = await fixture();
    await f.t.mutation((ctx) =>
      seedAnalyticsConsent(ctx, { userId: f.identity.userId, decidedAt: NOW })
    );
    await f.t.mutation(claim, { turnId: f.turnId });
    const streamId = await f.t.mutation((ctx) =>
      ctx.runMutation(components.nina.streams.create, {
        threadId: f.threadId,
        order: 0,
        stepOrder: 1,
        format: "UIMessageChunk",
      })
    );
    await f.owner.mutation(cancel, { chatId: f.chatId });

    // The stream is cut off, but the turn stays open with its credits held.
    const stopping = await f.inspect();
    expect(stopping.turn).toMatchObject({
      phase: "active",
      state: { status: "running" },
      cancelRequestedAt: NOW,
    });
    expect(stopping.user?.credits).toBe(0);
    expect(stopping.chat?.activeTurnId).toBe(f.turnId);
    expect(Arr.filter(stopping.ledger, (row) => row.type === "refund")).toEqual(
      []
    );
    expect(stopping.messages.page[0]).toMatchObject({
      message: { role: "user" },
      status: "failed",
    });
    expect(
      await f.t.query((ctx) =>
        listStreams(ctx, components.nina, {
          threadId: f.threadId,
          includeStatuses: ["aborted"],
        })
      )
    ).toEqual([expect.objectContaining({ streamId, status: "aborted" })]);
    // The run exits once its stream has stopped, and only then does it settle.
    await f.t.mutation(recover, { turnId: f.turnId, failure: "interrupted" });
    const settled = await f.inspect();
    expect(settled.turn?.state).toEqual({
      status: "cancelled",
      finishedAt: NOW,
    });
    expect(settled.turn).not.toHaveProperty("cancelRequestedAt");
    expect(settled.user?.credits).toBe(10);
    expect(settled.chat?.activeTurnId).toBeUndefined();
    expect(
      Arr.filter(settled.ledger, (row) => row.type === "refund")
    ).toHaveLength(1);
    const events = await f.t.query((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );
    expect(
      Arr.filter(events, (job) => job.name.includes("deliverProductEvent"))
    ).toEqual([]);

    // The settlement scheduled for the grace finds the turn settled and
    // changes nothing.
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    const later = await f.inspect();
    expect(later.turn?.state).toEqual({ status: "cancelled", finishedAt: NOW });
    expect(later.user?.credits).toBe(10);
    expect(
      Arr.filter(later.ledger, (row) => row.type === "refund")
    ).toHaveLength(1);
  });

  it("settles a stopped turn once the grace has passed when its run never exits", async () => {
    const f = await fixture();
    await f.t.mutation(claim, { turnId: f.turnId });
    await f.owner.mutation(cancel, { chatId: f.chatId });
    const grace = Duration.toMillis(STOP_GRACE);
    const jobs = await f.t.query((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );
    expect(
      Arr.filter(jobs, (job) => job.name === "nina/lifecycle:recover")
    ).toEqual([
      expect.objectContaining({
        args: [{ turnId: f.turnId }],
        scheduledTime: NOW + grace,
      }),
    ]);
    // The run is gone, so until then the turn stays open with its credits held.
    const waiting = await f.inspect();
    expect(waiting.chat?.activeTurnId).toBe(f.turnId);
    expect(waiting.user?.credits).toBe(0);

    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    const state = await f.inspect();
    // The turn finished when the learner stopped it, not when the grace settled it.
    expect(state.turn?.state).toEqual({
      status: "cancelled",
      finishedAt: NOW,
    });
    expect(state.user?.credits).toBe(10);
    expect(state.chat?.activeTurnId).toBeUndefined();
    expect(
      Arr.filter(state.ledger, (row) => row.type === "refund")
    ).toHaveLength(1);
  });

  it("keeps the first request when a running turn is stopped twice", async () => {
    const f = await fixture();
    await f.t.mutation(claim, { turnId: f.turnId });
    await f.owner.mutation(cancel, { chatId: f.chatId });
    vi.setSystemTime(NOW + 5000);
    await f.owner.mutation(cancel, { chatId: f.chatId });
    expect((await f.inspect()).turn).toMatchObject({ cancelRequestedAt: NOW });
  });

  it("refunds a stopped generation with no final text and never enlarges the next credit period", async () => {
    const f = await fixture();
    await f.t.mutation((ctx) =>
      saveMessages(ctx, components.nina, {
        threadId: f.threadId,
        promptMessageId: f.promptMessageId,
        messages: [
          {
            role: "assistant",
            content: [{ type: "reasoning", text: "Thinking" }],
          },
        ],
        metadata: [{ finishReason: "stop" }],
      })
    );
    vi.setSystemTime(NOW + 86_400_000);
    await f.t.mutation(recover, { turnId: f.turnId });
    const state = await f.inspect();
    expect(state.turn?.state.status).toBe("failed");
    expect(state.user?.credits).toBe(10);
    expect(Option.getOrThrow(Arr.last(state.ledger))).toMatchObject({
      type: "refund",
      amount: 0,
    });
  });
  it.each([
    "deleted-user",
    "missing-user",
    "missing-chat",
    "replaced-turn",
  ] as const)(
    "cancels a queued generation after %s without reviving ownership",
    async (state) => {
      const f = await fixture();
      await f.t.mutation(async (ctx) => {
        if (state === "deleted-user") {
          await ctx.db.patch("users", f.identity.userId, {
            deletionPreparedAt: NOW,
          });
        }
        if (state === "missing-user") {
          await ctx.db.delete("users", f.identity.userId);
        }
        if (state === "missing-chat") {
          await ctx.db.delete("chats", f.chatId);
        }
        if (state === "replaced-turn") {
          await ctx.db.patch("chats", f.chatId, { activeTurnId: undefined });
        }
      });
      expect(
        Ref.decodeReturnsSync(
          refs.internal.nina.lifecycle.claim,
          await f.t.mutation(claim, { turnId: f.turnId })
        )
      ).toBeNull();
      expect((await f.inspect()).turn?.state.status).toBe("cancelled");
    }
  );

  it("ignores deleted turns and delayed usage without recreating data", async () => {
    const f = await fixture();
    await f.t.mutation((ctx) => ctx.db.delete("ninaTurns", f.turnId));
    await f.t.mutation(claim, { turnId: f.turnId });
    await f.t.mutation(recover, { turnId: f.turnId });
    await f.owner.mutation(cancel, { chatId: f.chatId });
    await f.t.mutation(record, {
      turnId: f.turnId,
      usage: {
        agent: "nina",
        model: "gateway-model",
        provider: "gateway",
        input: 1,
        output: 1,
      },
    });
    expect((await f.inspect()).turn).toBeNull();
  });

  it("translates an unexpected settlement defect and rolls back cancellation", async () => {
    const f = await fixture();
    vi.mocked(settleTurn).mockReturnValueOnce(
      Effect.die("Private storage diagnostic")
    );
    await expect(
      f.owner.mutation(cancel, { chatId: f.chatId })
    ).rejects.toMatchObject({ data: { code: "NINA_WRITE_FAILED" } });
    expect((await f.inspect()).turn?.state.status).toBe("queued");
  });
  it("settles twice safely and rolls back when the component journal is unavailable", async () => {
    const { t, ...f } = await fixture();
    vi.mocked(readThread).mockReturnValueOnce(
      Effect.fail(new SealedReadError())
    );
    await expect(
      f.owner.mutation(cancel, { chatId: f.chatId })
    ).rejects.toMatchObject({ data: { code: "NINA_WRITE_FAILED" } });
    expect((await f.inspect()).user?.credits).toBe(0);
    await f.owner.mutation(cancel, { chatId: f.chatId });
    await t.mutation((ctx) =>
      ctx.db.patch("chats", f.chatId, { activeTurnId: f.turnId })
    );
    await f.owner.mutation(
      Ref.getFunctionReference(refs.public.chats.mutations.deleteChat),
      { chatId: f.chatId }
    );
    const state = await f.inspect();
    expect(state.user?.credits).toBe(10);
    expect(
      Arr.filter(state.ledger, (row) => row.type === "refund")
    ).toHaveLength(1);
  });
});
