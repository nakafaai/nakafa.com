import { Ref } from "@confect/core";
import { listMessages, listStreams, saveMessages } from "@convex-dev/agent";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import { settleTurn } from "@repo/backend/confect/nina/settlement";
import { seedAnalyticsConsent } from "@repo/backend/confect/test.helpers";
import { createNinaTest } from "@repo/backend/test/nina";
import { Array as Arr, Effect, Option, pipe, Schema } from "effect";

vi.mock("@repo/backend/confect/nina/settlement", async (load) => {
  const actual =
    await load<typeof import("@repo/backend/confect/nina/settlement")>();
  return { ...actual, settleTurn: vi.fn(actual.settleTurn) };
});

vi.mock("@convex-dev/agent", async (load) => {
  const actual = await load<typeof import("@convex-dev/agent")>();
  return { ...actual, listMessages: vi.fn(actual.listMessages) };
});

const NOW = Date.UTC(2026, 8, 27, 12);
const claim = Ref.getFunctionReference(refs.internal.nina.lifecycle.claim);
const recover = Ref.getFunctionReference(refs.internal.nina.lifecycle.recover);
const cancel = Ref.getFunctionReference(refs.public.nina.lifecycle.cancel);
const record = Ref.getFunctionReference(refs.internal.nina.usage.record);
const JsonTextSchema = Schema.fromJsonString(Schema.Unknown);

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
    ).toMatchObject({ state: { status: "running" } });
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
          properties: Schema.encodeSync(JsonTextSchema)({
            chat_type: "study",
            model_id: "nakafa-lite",
            error_code: "interrupted",
          }),
        }),
      ],
    ]);
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
    await f.t.mutation(recover, { turnId: f.turnId });
    const state = await f.inspect();
    expect(state.turn?.state.status).toBe("complete");
    expect(state.user?.credits).toBe(8);
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
          properties: Schema.encodeSync(JsonTextSchema)({
            chat_type: "study",
            model_id: "nakafa-lite",
            credits: 2,
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
    expect(state.ledger.at(-1)).toMatchObject({ type: "refund", amount: 0 });
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
    vi.mocked(listMessages).mockRejectedValueOnce(
      new Error("Private component failure")
    );
    await expect(
      f.owner.mutation(cancel, { chatId: f.chatId })
    ).rejects.toMatchObject({ data: { code: "NINA_WRITE_FAILED" } });
    expect((await f.inspect()).user?.credits).toBe(8);
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
