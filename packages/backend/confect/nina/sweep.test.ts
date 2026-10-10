import { Ref } from "@confect/core";
import { listMessages, saveMessages } from "@convex-dev/agent";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import { TURN_DEADLINE } from "@repo/backend/confect/nina/sweep";
import { seedAnalyticsConsent } from "@repo/backend/confect/test.helpers";
import { createNinaTest } from "@repo/backend/test/nina";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Duration, pipe, Struct } from "effect";

vi.mock("@convex-dev/agent", async (load) => {
  const actual = await load<typeof import("@convex-dev/agent")>();
  return { ...actual, listMessages: vi.fn(actual.listMessages) };
});

const NOW = Date.UTC(2026, 8, 27, 12);
const DEADLINE = Duration.toMillis(TURN_DEADLINE);
const PAGE = 50;
const claim = Ref.getFunctionReference(refs.internal.nina.lifecycle.claim);
const recover = Ref.getFunctionReference(refs.internal.nina.lifecycle.recover);
const sweep = Ref.getFunctionReference(refs.internal.nina.lifecycle.sweep);

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
  /** The arguments of every job the function has queued, oldest first. */
  const queued = async (name: string) =>
    pipe(
      await t.query((ctx) => ctx.db.system.query("_scheduled_functions").collect()),
      Arr.filter((job) => job.name === name),
      Arr.map((job) => job.args[0])
    );
  /** Runs each queued settlement the way the scheduler would. */
  const settle = async () => {
    for (const args of await queued("nina/lifecycle:recover")) {
      await t.mutation(recover, args);
    }
  };
  return { ...seeded, inspect, queued, settle };
}

describe("Nina turn sweep", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("fails, refunds and unlocks a turn left running past the deadline", async () => {
    const f = await fixture();
    await f.t.mutation((ctx) =>
      seedAnalyticsConsent(ctx, { userId: f.identity.userId, decidedAt: NOW })
    );
    await f.t.mutation(claim, { turnId: f.turnId });
    const overdue = NOW + DEADLINE + 1;
    vi.setSystemTime(overdue);

    await f.t.mutation(sweep, {});
    expect(await f.queued("nina/lifecycle:recover")).toEqual([
      { turnId: f.turnId, failure: "response-timeout" },
    ]);
    await f.settle();

    const state = await f.inspect();
    expect(state.turn?.state).toEqual({
      status: "failed",
      finishedAt: overdue,
      reason: "response-timeout",
    });
    expect(state.user?.credits).toBe(10);
    expect(Arr.filter(state.ledger, (row) => row.type === "refund")).toHaveLength(
      1
    );
    expect(state.chat?.activeTurnId).toBeUndefined();
    expect(state.messages.page[0]).toMatchObject({
      message: { role: "user" },
      status: "failed",
    });
    const events = pipe(
      await f.t.query((ctx) =>
        ctx.db.system.query("_scheduled_functions").collect()
      ),
      Arr.filter((job) => job.name.includes("deliverProductEvent")),
      Arr.map((job) => job.args)
    );
    expect(events).toEqual([
      [
        expect.objectContaining({
          event: "chat response failed",
          properties: encodeJsonText({
            chat_type: "study",
            error_code: "response-timeout",
          }),
        }),
      ],
    ]);
  });

  it("settles a turn whose run never started", async () => {
    const f = await fixture();
    vi.setSystemTime(NOW + DEADLINE + 1);
    await f.t.mutation(sweep, {});
    await f.settle();
    const state = await f.inspect();
    expect(state.turn?.state).toMatchObject({
      status: "failed",
      reason: "response-timeout",
    });
    expect(state.user?.credits).toBe(10);
    expect(state.chat?.activeTurnId).toBeUndefined();
  });

  it("leaves a turn alone until its age passes the deadline", async () => {
    const f = await fixture();
    await f.t.mutation(claim, { turnId: f.turnId });
    vi.setSystemTime(NOW + DEADLINE);
    await f.t.mutation(sweep, {});
    expect(await f.queued("nina/lifecycle:recover")).toEqual([]);
    vi.setSystemTime(NOW + DEADLINE + 1);
    await f.t.mutation(sweep, {});
    expect(await f.queued("nina/lifecycle:recover")).toHaveLength(1);
  });

  it("measures a running turn from the moment its run started", async () => {
    const f = await fixture();
    const startedAt = NOW + DEADLINE - 1000;
    vi.setSystemTime(startedAt);
    await f.t.mutation(claim, { turnId: f.turnId });
    vi.setSystemTime(NOW + DEADLINE + 1);
    await f.t.mutation(sweep, {});
    expect(await f.queued("nina/lifecycle:recover")).toEqual([]);
    vi.setSystemTime(startedAt + DEADLINE + 1);
    await f.t.mutation(sweep, {});
    expect(await f.queued("nina/lifecycle:recover")).toHaveLength(1);
  });

  it("keeps an answer the run saved before its settlement was lost", async () => {
    const f = await fixture();
    await f.t.mutation(claim, { turnId: f.turnId });
    await f.t.mutation((ctx) =>
      saveMessages(ctx, components.nina, {
        threadId: f.threadId,
        promptMessageId: f.promptMessageId,
        messages: [{ role: "assistant", content: "The verified limit is 2." }],
        metadata: [{ finishReason: "stop" }],
      })
    );
    vi.setSystemTime(NOW + DEADLINE + 1);
    await f.t.mutation(sweep, {});
    await f.settle();
    const state = await f.inspect();
    expect(state.turn?.state.status).toBe("complete");
    expect(state.user?.credits).toBe(5);
    expect(Arr.filter(state.ledger, (row) => row.type === "refund")).toEqual([]);
    expect(await f.queued("nina/response:present")).toEqual([
      { turnId: f.turnId },
    ]);
  });

  it("reads one page of overdue turns at a time and hands the rest on", async () => {
    const f = await fixture();
    await f.t.mutation(async (ctx) => {
      const turn = await ctx.db.get("ninaTurns", f.turnId);
      if (turn?.phase !== "active") {
        return;
      }
      for (let copy = 0; copy < PAGE; copy += 1) {
        await ctx.db.insert(
          "ninaTurns",
          Struct.omit(turn, ["_id", "_creationTime"])
        );
      }
    });
    vi.setSystemTime(NOW + DEADLINE + 1);

    await f.t.mutation(sweep, {});
    expect(await f.queued("nina/lifecycle:recover")).toHaveLength(PAGE);
    const [next, ...rest] = await f.queued("nina/lifecycle:sweep");
    expect(rest).toEqual([]);
    expect(next).toEqual({
      resume: { before: NOW + 1, cursor: expect.any(String) },
    });

    vi.setSystemTime(NOW + DEADLINE + 2 * 60_000);
    await f.t.mutation(sweep, next);
    const settled = await f.queued("nina/lifecycle:recover");
    expect(settled).toHaveLength(PAGE + 1);
    expect(Arr.dedupeWith(settled, (a, b) => a.turnId === b.turnId)).toHaveLength(
      PAGE + 1
    );
    expect(await f.queued("nina/lifecycle:sweep")).toHaveLength(1);
  });

  it("tries again on the next sweep when a settlement failed", async () => {
    const f = await fixture();
    await f.t.mutation(claim, { turnId: f.turnId });
    vi.setSystemTime(NOW + DEADLINE + 1);
    await f.t.mutation(sweep, {});
    vi.mocked(listMessages).mockRejectedValueOnce(
      new Error("Private component failure")
    );
    await expect(f.settle()).rejects.toMatchObject({
      data: { code: "NINA_WRITE_FAILED" },
    });
    const stuck = await f.inspect();
    expect(stuck.turn?.state.status).toBe("running");
    expect(stuck.chat?.activeTurnId).toBe(f.turnId);
    expect(stuck.user?.credits).toBe(5);

    vi.setSystemTime(NOW + DEADLINE + 5 * 60_000);
    await f.t.mutation(sweep, {});
    expect(await f.queued("nina/lifecycle:recover")).toHaveLength(2);
    await f.t.mutation(recover, (await f.queued("nina/lifecycle:recover"))[1]);
    const state = await f.inspect();
    expect(state.turn?.state.status).toBe("failed");
    expect(state.user?.credits).toBe(10);
    expect(state.chat?.activeTurnId).toBeUndefined();
  });

  it("settles once however many sweeps and late results reach the turn", async () => {
    const f = await fixture();
    await f.t.mutation((ctx) =>
      seedAnalyticsConsent(ctx, { userId: f.identity.userId, decidedAt: NOW })
    );
    await f.t.mutation(claim, { turnId: f.turnId });
    vi.setSystemTime(NOW + DEADLINE + 1);
    await f.t.mutation(sweep, {});
    await f.t.mutation(sweep, {});
    expect(await f.queued("nina/lifecycle:recover")).toHaveLength(2);
    await f.settle();
    // The run's own exit and a check scheduled before this deploy arrive late.
    await f.t.mutation(recover, { turnId: f.turnId, failure: "interrupted" });
    await f.t.mutation(recover, { turnId: f.turnId });
    await f.t.mutation(sweep, {});
    await f.settle();

    const state = await f.inspect();
    expect(state.turn?.state).toMatchObject({
      status: "failed",
      reason: "response-timeout",
    });
    expect(state.user?.credits).toBe(10);
    expect(Arr.filter(state.ledger, (row) => row.type === "refund")).toHaveLength(
      1
    );
    const events = Arr.filter(
      await f.t.query((ctx) =>
        ctx.db.system.query("_scheduled_functions").collect()
      ),
      (job) => job.name.includes("deliverProductEvent")
    );
    expect(events).toHaveLength(1);
  });
});
