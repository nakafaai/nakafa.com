import { Ref } from "@confect/core";
import { listMessages, saveMessages } from "@convex-dev/agent";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import {
  SETTLE_GRACE,
  START_DEADLINE,
  TURN_DEADLINE,
} from "@repo/backend/confect/nina/deadline";
import { readThread } from "@repo/backend/confect/nina/sealed/thread";
import { SealedReadError } from "@repo/backend/confect/nina/sealed.spec";
import { SEAL_BYTES_PER_SWEEP } from "@repo/backend/confect/nina/sweep";
import { seedAnalyticsConsent } from "@repo/backend/confect/test.helpers";
import { createNinaTest } from "@repo/backend/test/nina";
import { stubReport } from "@repo/backend/test/nina/report";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Duration, Effect, pipe, Struct } from "effect";

vi.mock("@repo/backend/confect/nina/sealed/thread", async (load) => {
  const actual =
    await load<typeof import("@repo/backend/confect/nina/sealed/thread")>();
  return { ...actual, readThread: vi.fn(actual.readThread) };
});
const NOW = Date.UTC(2026, 8, 27, 12);
const DEADLINE = Duration.toMillis(TURN_DEADLINE);
const START = Duration.toMillis(START_DEADLINE);
const GRACE = Duration.toMillis(SETTLE_GRACE);
const PAGE = 50;
const claim = Ref.getFunctionReference(refs.internal.nina.lifecycle.claim);
const recover = Ref.getFunctionReference(refs.internal.nina.lifecycle.recover);
const sweep = Ref.getFunctionReference(refs.internal.nina.lifecycle.sweep);
const expire = Ref.getFunctionReference(refs.internal.nina.lifecycle.expire);
const cancel = Ref.getFunctionReference(refs.public.nina.lifecycle.cancel);

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
      await t.query((ctx) =>
        ctx.db.system.query("_scheduled_functions").collect()
      ),
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
  /** The queue that carries an exception to error tracking. */
  let report: ReturnType<typeof stubReport>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    report = stubReport();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("ends a turn whose run was lost as interrupted, refunds it and unlocks its chat", async () => {
    const f = await fixture();
    await f.t.mutation((ctx) =>
      seedAnalyticsConsent(ctx, { userId: f.identity.userId, decidedAt: NOW })
    );
    await f.t.mutation(claim, { turnId: f.turnId });
    const overdue = NOW + DEADLINE + 1;
    vi.setSystemTime(overdue);

    await f.t.mutation(sweep, {});
    // No run is alive past the deadline, so the turn was not too slow: its run
    // was lost, and the sweep does not call that a timeout.
    expect(await f.queued("nina/lifecycle:recover")).toEqual([
      { turnId: f.turnId },
    ]);
    // The sweep only finds the turn. The report comes with its ending.
    expect(report).not.toHaveBeenCalled();
    await f.settle();

    const state = await f.inspect();
    expect(state.turn?.state).toEqual({
      status: "failed",
      finishedAt: overdue,
      reason: "interrupted",
    });
    expect(state.user?.credits).toBe(10);
    expect(
      Arr.filter(state.ledger, (row) => row.type === "refund")
    ).toHaveLength(1);
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
            error_code: "interrupted",
          }),
        }),
      ],
    ]);
    // No run is left to report the loss, so its ending reports it, once.
    expect(report).toHaveBeenCalledOnce();
  });

  it("settles a queued turn that no run claimed when its start check was lost", async () => {
    const f = await fixture();
    vi.setSystemTime(NOW + DEADLINE + 1);
    await f.t.mutation(sweep, {});
    await f.settle();
    const state = await f.inspect();
    expect(state.turn?.state).toMatchObject({
      status: "failed",
      reason: "interrupted",
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

  it("ends a turn whose run starts too late as timed out, with its credits back", async () => {
    const f = await fixture();
    const late = NOW + START + 1;
    vi.setSystemTime(late);
    expect(await f.t.mutation(claim, { turnId: f.turnId })).toBeNull();
    const state = await f.inspect();
    expect(state.turn?.state).toEqual({
      status: "failed",
      finishedAt: late,
      reason: "response-timeout",
    });
    expect(state.user?.credits).toBe(10);
    expect(state.chat?.activeTurnId).toBeUndefined();
    expect(state.messages.page[0]).toMatchObject({ status: "failed" });
  });

  it("measures a run that started at the last moment from its turn's admission", async () => {
    const f = await fixture();
    vi.setSystemTime(NOW + START);
    expect(await f.t.mutation(claim, { turnId: f.turnId })).toMatchObject({
      state: { status: "running", startedAt: NOW + START },
    });
    vi.setSystemTime(NOW + DEADLINE);
    await f.t.mutation(sweep, {});
    expect(await f.queued("nina/lifecycle:recover")).toEqual([]);
    vi.setSystemTime(NOW + DEADLINE + 1);
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
    expect(Arr.filter(state.ledger, (row) => row.type === "refund")).toEqual(
      []
    );
    expect(await f.queued("nina/response:present")).toEqual([
      { turnId: f.turnId },
    ]);
    // The journal held the answer, so nothing was lost and nothing is reported.
    expect(report).not.toHaveBeenCalled();
  });

  it("schedules the end of a settlement for one grace after each sweep that finds the turn", async () => {
    const f = await fixture();
    await f.t.mutation(claim, { turnId: f.turnId });
    const found = NOW + DEADLINE + 1;
    vi.setSystemTime(found);
    await f.t.mutation(sweep, {});
    vi.setSystemTime(found + GRACE / 3);
    await f.t.mutation(sweep, {});

    const jobs = await f.t.query((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );
    expect(
      pipe(
        jobs,
        Arr.filter((job) => job.name === "nina/lifecycle:abandon"),
        Arr.map((job) => [job.args[0], job.scheduledTime])
      )
    ).toEqual([
      [{ turnId: f.turnId }, found + GRACE],
      [{ turnId: f.turnId }, found + GRACE / 3 + GRACE],
    ]);
    // The sweep only schedules it. The turn is still open until a try works.
    expect((await f.inspect()).turn?.phase).toBe("active");
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
    expect(
      Arr.dedupeWith(settled, (a, b) => a.turnId === b.turnId)
    ).toHaveLength(PAGE + 1);
    expect(await f.queued("nina/lifecycle:sweep")).toHaveLength(1);
  });

  it("tries again on the next sweep when a settlement failed", async () => {
    const f = await fixture();
    await f.t.mutation(claim, { turnId: f.turnId });
    vi.setSystemTime(NOW + DEADLINE + 1);
    await f.t.mutation(sweep, {});
    vi.mocked(readThread).mockReturnValueOnce(
      Effect.fail(new SealedReadError())
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

  it("settles a stopped turn whose run never exited as cancelled, with no failure event", async () => {
    const f = await fixture();
    await f.t.mutation((ctx) =>
      seedAnalyticsConsent(ctx, { userId: f.identity.userId, decidedAt: NOW })
    );
    await f.t.mutation(claim, { turnId: f.turnId });
    await f.owner.mutation(cancel, { chatId: f.chatId });
    expect((await f.inspect()).turn?.state.status).toBe("running");

    const overdue = NOW + DEADLINE + 1;
    vi.setSystemTime(overdue);
    await f.t.mutation(sweep, {});
    await f.settle();

    const state = await f.inspect();
    // The turn finished when the learner stopped it, not when the sweep found it.
    expect(state.turn?.state).toEqual({
      status: "cancelled",
      finishedAt: NOW,
    });
    expect(state.user?.credits).toBe(10);
    expect(state.chat?.activeTurnId).toBeUndefined();
    const events = Arr.filter(
      await f.t.query((ctx) =>
        ctx.db.system.query("_scheduled_functions").collect()
      ),
      (job) => job.name.includes("deliverProductEvent")
    );
    expect(events).toEqual([]);
    // A stop the learner asked for is not a loss to report.
    expect(report).not.toHaveBeenCalled();
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
      reason: "interrupted",
    });
    expect(state.user?.credits).toBe(10);
    expect(
      Arr.filter(state.ledger, (row) => row.type === "refund")
    ).toHaveLength(1);
    const events = Arr.filter(
      await f.t.query((ctx) =>
        ctx.db.system.query("_scheduled_functions").collect()
      ),
      (job) => job.name.includes("deliverProductEvent")
    );
    expect(events).toHaveLength(1);
    expect(report).toHaveBeenCalledOnce();
  });
});

describe("Nina turn start check", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("settles a turn whose run never started as timed out, with its credits back, and unlocks its chat", async () => {
    const f = await fixture();
    await f.t.mutation((ctx) =>
      seedAnalyticsConsent(ctx, { userId: f.identity.userId, decidedAt: NOW })
    );
    const checked = NOW + START;
    vi.setSystemTime(checked);
    await f.t.mutation(expire, { turnId: f.turnId });

    const state = await f.inspect();
    expect(state.turn?.state).toEqual({
      status: "failed",
      finishedAt: checked,
      reason: "response-timeout",
    });
    expect(state.user?.credits).toBe(10);
    expect(
      Arr.filter(state.ledger, (row) => row.type === "refund")
    ).toHaveLength(1);
    expect(state.chat?.activeTurnId).toBeUndefined();
    expect(state.messages.page[0]).toMatchObject({ status: "failed" });
  });

  it("leaves a turn alone whose run started in time", async () => {
    const f = await fixture();
    await f.t.mutation(claim, { turnId: f.turnId });
    vi.setSystemTime(NOW + START);
    await f.t.mutation(expire, { turnId: f.turnId });

    const state = await f.inspect();
    expect(state.turn?.state).toMatchObject({ status: "running" });
    expect(state.user?.credits).toBe(5);
    expect(state.chat?.activeTurnId).toBe(f.turnId);
  });

  it("leaves a turn alone that settled before the check, and pays nothing back twice", async () => {
    const f = await fixture();
    await f.owner.mutation(cancel, { chatId: f.chatId });
    vi.setSystemTime(NOW + START);
    await f.t.mutation(expire, { turnId: f.turnId });

    const state = await f.inspect();
    expect(state.turn?.state).toMatchObject({ status: "cancelled" });
    expect(state.user?.credits).toBe(10);
    expect(
      Arr.filter(state.ledger, (row) => row.type === "refund")
    ).toHaveLength(1);
  });
});

describe("Nina sweep seals settled turns", () => {
  type Deployment = Awaited<ReturnType<typeof createNinaTest>>;

  /** Each settled turn of the chat, by order, and whether its rows are sealed. */
  const settledSeals = (t: Deployment["t"]) =>
    t.query(async (ctx) =>
      Arr.flatMap(await ctx.db.query("ninaTurns").collect(), (turn) =>
        turn.phase === "settled"
          ? [{ order: turn.order, sealed: turn.sealedAt !== undefined }]
          : []
      )
    );

  /** The ids of the stored rows of the chat's thread that were written at an order below `before`. */
  const rowIdsBelow = (f: Deployment, before: number) =>
    f.t
      .query((ctx) =>
        listMessages(ctx, components.nina, {
          paginationOpts: { cursor: null, numItems: 200 },
          threadId: f.threadId,
        })
      )
      .then((rows) =>
        Arr.flatMap(rows.page, (row) => (row.order < before ? [row._id] : []))
      );

  it("schedules one drain of the settled turns per run, within the byte budget of the run", async () => {
    const f = await createNinaTest({ history: 1, now: NOW });
    await f.t.mutation(sweep, {});

    const jobs = await f.t.query((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );
    expect(
      Arr.map(
        Arr.filter(jobs, (job) => job.name === "nina/sealed:drain"),
        (job) => job.args[0]
      )
    ).toEqual([{ budget: SEAL_BYTES_PER_SWEEP }]);
  });

  it("reaches the old turns that still hold plain rows, and leaves a sealed turn alone", async () => {
    const turns = 3;
    const f = await createNinaTest({ history: turns, now: NOW });
    await f.t.mutation(sweep, {});
    await f.t.finishAllScheduledFunctions(() => undefined);

    // Each turn is small, so the run's budget covers all of them.
    expect(await settledSeals(f.t)).toEqual(
      Arr.makeBy(turns, (order) => ({ order, sealed: true }))
    );
    const sealedBefore = await rowIdsBelow(f, turns);

    await f.t.mutation(sweep, {});
    await f.t.finishAllScheduledFunctions(() => undefined);

    expect(await settledSeals(f.t)).toEqual(
      Arr.makeBy(turns, (order) => ({ order, sealed: true }))
    );
    expect(await rowIdsBelow(f, turns)).toEqual(sealedBefore);
  });
});
