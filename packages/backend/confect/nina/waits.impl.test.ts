import { Ref } from "@confect/core";
import { saveMessages } from "@convex-dev/agent";
import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
} from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { appendNinaTurn, createNinaTest } from "@repo/backend/test/nina";
import { encodeJsonText } from "@repo/utilities/json";
import type { FunctionArgs } from "convex/server";

const NOW = Date.UTC(2026, 9, 12, 12);
/** The most turns one report reads. `waits.spec.ts` bounds the count with it, and ADR 0008 states it. */
const WAITS_MAX = 500;
const claim = Ref.getFunctionReference(refs.internal.nina.lifecycle.claim);
const recover = Ref.getFunctionReference(refs.internal.nina.lifecycle.recover);
const cancel = Ref.getFunctionReference(refs.public.nina.lifecycle.cancel);
const record = Ref.getFunctionReference(refs.internal.nina.usage.record);
const summary = Ref.getFunctionReference(refs.internal.nina.waits.summary);

type Fixture = Awaited<ReturnType<typeof createNinaTest>>;
type Queued = Pick<Fixture, "promptMessageId" | "turnId">;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

/** Queues one more turn in the chat of the fixture, `ms` after the start of the test. */
function queueAt(fixture: Fixture, ms: number, prompt: string) {
  vi.setSystemTime(NOW + ms);
  return appendNinaTurn(fixture, { prompt });
}

/** The run of `turn` starts and takes it, `ms` after the start of the test. */
function claimAt(fixture: Fixture, turn: Queued, ms: number) {
  vi.setSystemTime(NOW + ms);
  return fixture.t.mutation(claim, { turnId: turn.turnId });
}

/** The model's answer to `turn` reaches the Agent journal. */
function answer(fixture: Fixture, turn: Queued) {
  return fixture.t.mutation((ctx) =>
    saveMessages(ctx, components.nina, {
      threadId: fixture.threadId,
      promptMessageId: turn.promptMessageId,
      messages: [{ role: "assistant", content: "The verified limit is 2." }],
      metadata: [{ finishReason: "stop" }],
    })
  );
}

/** The run of `turn` exits, `ms` after the start of the test, and hands its stages to the settlement. */
function exitAt(
  fixture: Fixture,
  turn: Queued,
  ms: number,
  exit: Omit<FunctionArgs<typeof recover>, "turnId">
) {
  vi.setSystemTime(NOW + ms);
  return fixture.t.mutation(recover, { turnId: turn.turnId, ...exit });
}

/** The turn as the lifecycle stored it. */
async function stored(fixture: Fixture, turn: Queued) {
  const row = await fixture.t.query((ctx) =>
    ctx.db.get("ninaTurns", turn.turnId)
  );
  assert.ok(row, "Expected the turn to be stored.");
  return row;
}

/** The wait for the run to start that the claim stored, which the clock decides. */
async function claimed(fixture: Fixture, turn: Queued) {
  const { timing } = await stored(fixture, turn);
  assert.ok(timing?.claimedMs !== undefined, "Expected a stored claim.");
  return timing.claimedMs;
}

/** Runs the report the way `convex run` does, and decodes what it returns. */
async function report(fixture: Pick<Fixture, "t">, count: number) {
  return Ref.decodeReturnsSync(
    refs.internal.nina.waits.summary,
    await fixture.t.query(summary, { count })
  );
}

/** The turn that `createNinaTest` queues itself. */
function firstTurn(fixture: Fixture): Queued {
  return {
    promptMessageId: fixture.promptMessageId,
    turnId: fixture.turnId,
  };
}

/**
 * Three turns of one chat, each taken through the real lifecycle by its run,
 * the oldest first. The run of each noted what it reached and handed it over at
 * its exit; the claim stored the first wait of each.
 *
 * - A completes. Its run was claimed after 1 second, was ready after 1.5, saw a
 *   first sign of work after 3 and a first word after 3.2.
 * - B fails before the model showed anything. Claimed after 2 seconds, ready
 *   after 2.5.
 * - C is stopped by the learner. Claimed after 3 seconds, ready after 3.5, a
 *   first sign of work after 6.
 */
async function threeRuns() {
  const fixture = await createNinaTest({ now: NOW });
  const a = firstTurn(fixture);
  await claimAt(fixture, a, 1000);
  await answer(fixture, a);
  await exitAt(fixture, a, 5000, {
    timing: { progressMs: 3000, readyMs: 1500, tokenMs: 3200 },
  });
  const b = await queueAt(fixture, 10_000, "B");
  await claimAt(fixture, b, 12_000);
  await exitAt(fixture, b, 15_000, {
    failure: "provider-unavailable",
    timing: { readyMs: 2500 },
  });
  const c = await queueAt(fixture, 20_000, "C");
  await claimAt(fixture, c, 23_000);
  await fixture.owner.mutation(cancel, { chatId: fixture.chatId });
  await exitAt(fixture, c, 27_000, {
    timing: { progressMs: 6000, readyMs: 3500 },
  });
  return { a, b, c, fixture };
}

describe("report of the waits of the newest turns", () => {
  it("summarizes each wait over the turns that hold it, from turns the lifecycle settled", async () => {
    const { a, b, c, fixture } = await threeRuns();
    // The claim is the one wait that the clock decides: about 1, 2 and 3 seconds,
    // a few thousandths short because a creation time carries a fraction.
    const first = await claimed(fixture, a);
    const second = await claimed(fixture, b);
    const third = await claimed(fixture, c);
    expect(first).toBeCloseTo(1000, 1);
    expect(second).toBeCloseTo(2000, 1);
    expect(third).toBeCloseTo(3000, 1);

    const result = await report(fixture, 3);

    expect(result.read).toBe(3);
    expect(result.oldest).toBe((await stored(fixture, a))._creationTime);
    expect(result.newest).toBe((await stored(fixture, c))._creationTime);
    expect(result.statuses).toStrictEqual({
      cancelled: 1,
      complete: 1,
      failed: 1,
      open: 0,
    });
    // A stage that only some turns reached counts only those turns. With two
    // values the median is the lower one, a wait that someone had.
    expect(result.waits).toStrictEqual([
      {
        stage: "claimedMs",
        turns: 3,
        min: first,
        median: second,
        p90: third,
        max: third,
      },
      {
        stage: "readyMs",
        turns: 3,
        min: 1500,
        median: 2500,
        p90: 3500,
        max: 3500,
      },
      {
        stage: "progressMs",
        turns: 2,
        min: 3000,
        median: 3000,
        p90: 6000,
        max: 6000,
      },
      {
        stage: "tokenMs",
        turns: 1,
        min: 3200,
        median: 3200,
        p90: 3200,
        max: 3200,
      },
    ]);
  });

  it("names no learner, chat, turn or message", async () => {
    const { a, b, c, fixture } = await threeRuns();

    const text = encodeJsonText(await report(fixture, 3));

    for (const id of [
      fixture.identity.userId,
      fixture.chatId,
      fixture.threadId,
      a.turnId,
      b.turnId,
      c.turnId,
      a.promptMessageId,
      b.promptMessageId,
      c.promptMessageId,
    ]) {
      expect(text).not.toContain(id);
    }
  });

  it("reads the newest turns when the table holds more than the request", async () => {
    const { b, c, fixture } = await threeRuns();

    const result = await report(fixture, 2);

    // A, the oldest, is left out: its claim, its word and its status are gone.
    expect(result.read).toBe(2);
    expect(result.oldest).toBe((await stored(fixture, b))._creationTime);
    expect(result.newest).toBe((await stored(fixture, c))._creationTime);
    expect(result.statuses).toStrictEqual({
      cancelled: 1,
      complete: 0,
      failed: 1,
      open: 0,
    });
    const second = await claimed(fixture, b);
    const third = await claimed(fixture, c);
    expect(result.waits).toStrictEqual([
      {
        stage: "claimedMs",
        turns: 2,
        min: second,
        median: second,
        p90: third,
        max: third,
      },
      {
        stage: "readyMs",
        turns: 2,
        min: 2500,
        median: 2500,
        p90: 3500,
        max: 3500,
      },
      {
        stage: "progressMs",
        turns: 1,
        min: 6000,
        median: 6000,
        p90: 6000,
        max: 6000,
      },
      { stage: "tokenMs", turns: 0 },
    ]);
  });

  it("counts a turn that holds no wait as read and leaves it out of every wait it lacks", async () => {
    // Two turns settled before turns stored waits hold none, and the fixture's
    // own turn is still queued.
    const fixture = await createNinaTest({ history: 2, now: NOW });
    // The learner stops a turn before its run starts it: it settles with no wait.
    await queueAt(fixture, 10_000, "stopped");
    vi.setSystemTime(NOW + 11_000);
    await fixture.owner.mutation(cancel, { chatId: fixture.chatId });
    // The run of another turn starts and has not exited: it holds its claim and
    // no more.
    const running = await queueAt(fixture, 20_000, "running");
    await claimAt(fixture, running, 22_000);

    const result = await report(fixture, 5);

    expect(result.read).toBe(5);
    expect(result.statuses).toStrictEqual({
      cancelled: 1,
      complete: 2,
      failed: 0,
      open: 2,
    });
    // A missing wait is no wait of zero: the one claim is not pulled down by
    // the four turns that have none.
    const wait = await claimed(fixture, running);
    expect(wait).toBeCloseTo(2000, 1);
    expect(result.waits).toStrictEqual([
      {
        stage: "claimedMs",
        turns: 1,
        min: wait,
        median: wait,
        p90: wait,
        max: wait,
      },
      { stage: "readyMs", turns: 0 },
      { stage: "progressMs", turns: 0 },
      { stage: "tokenMs", turns: 0 },
    ]);
  });

  it("counts a wait of zero milliseconds as a wait, not as a missing one", async () => {
    // A run that starts in the millisecond of the admission waited zero, and so
    // did a stage that a run reached while its own clock was behind the
    // database's: a wait is never below zero. A zero is a wait that someone had.
    const fixture = await createNinaTest({ now: NOW });
    const first = firstTurn(fixture);
    await claimAt(fixture, first, 0);
    await answer(fixture, first);
    await exitAt(fixture, first, 0, { timing: { readyMs: 0 } });
    const second = await queueAt(fixture, 10_000, "second");
    await claimAt(fixture, second, 12_000);
    await exitAt(fixture, second, 15_000, {
      failure: "provider-unavailable",
      timing: { readyMs: 2500 },
    });
    expect(await claimed(fixture, first)).toBe(0);
    const wait = await claimed(fixture, second);

    const result = await report(fixture, 2);

    // With two values the median is the lower one, so the zero is the minimum
    // and the median of both waits.
    expect(result.waits).toStrictEqual([
      { stage: "claimedMs", turns: 2, min: 0, median: 0, p90: wait, max: wait },
      { stage: "readyMs", turns: 2, min: 0, median: 0, p90: 2500, max: 2500 },
      { stage: "progressMs", turns: 0 },
      { stage: "tokenMs", turns: 0 },
    ]);
  });

  it("returns counts of zero and no spread when there is no turn", async () => {
    const t = createConvexTestWithBetterAuth();

    const result = await report({ t }, 10);

    expect(result).toStrictEqual({
      read: 0,
      statuses: {
        cancelled: 0,
        complete: 0,
        failed: 0,
        open: 0,
      },
      waits: [
        { stage: "claimedMs", turns: 0 },
        { stage: "readyMs", turns: 0 },
        { stage: "progressMs", turns: 0 },
        { stage: "tokenMs", turns: 0 },
      ],
    });
  });

  it.each([
    ["a count above the maximum", WAITS_MAX + 1, `between 1 and ${WAITS_MAX}`],
    ["a count of zero", 0, `between 1 and ${WAITS_MAX}`],
    ["a count that is not a whole number", 2.5, "Expected an integer"],
  ])("refuses %s with the error of its schema", async (_, count, message) => {
    const t = createConvexTestWithBetterAuth();

    await expect(t.query(summary, { count })).rejects.toThrow(message);
  });

  it("reads one document for each turn at the maximum, in one query and far inside what a query may read", async () => {
    // One turn as a run leaves it: its waits, and the usage of the models it
    // called. The table then holds the maximum and two more turns, all of them
    // copies of it.
    const fixture = await createNinaTest({ now: NOW });
    const first = firstTurn(fixture);
    await claimAt(fixture, first, 1000);
    for (const agent of ["nina", "research", "research", "math-repair"]) {
      await fixture.t.mutation(record, {
        turnId: first.turnId,
        usage: {
          agent,
          input: 12,
          model: "gateway-model",
          output: 4,
          provider: "gateway",
        },
      });
    }
    await answer(fixture, first);
    await exitAt(fixture, first, 5000, {
      timing: { progressMs: 3000, readyMs: 1500, tokenMs: 3200 },
    });
    const { _id, _creationTime, ...turn } = await stored(fixture, first);
    // The copies hold what makes a turn heavy, so the bytes below mean something:
    // its page context, the usage of the models it called, and all four waits.
    expect(turn.page).toBeDefined();
    expect(turn.usage).toHaveLength(3);
    expect(turn.timing).toStrictEqual({
      claimedMs: expect.any(Number),
      progressMs: 3000,
      readyMs: 1500,
      tokenMs: 3200,
    });
    await fixture.t.mutation(async (ctx) => {
      for (let copy = 0; copy <= WAITS_MAX; copy += 1) {
        await ctx.db.insert("ninaTurns", turn);
      }
    });

    const run = await fixture.t.mutation(async (ctx) => {
      const result = await ctx.runQuery(summary, { count: WAITS_MAX });
      return { metrics: await ctx.meta.getTransactionMetrics(), result };
    });

    expect(run.result.read).toBe(WAITS_MAX);
    expect(run.metrics.documentsRead.used).toBe(WAITS_MAX);
    expect(run.metrics.databaseQueries.used).toBe(1);
    // The bytes are not pinned, because they move with the text of the fixture.
    // What is pinned is the margin: the run stays under a tenth of what the
    // transaction may read.
    const { remaining, used } = run.metrics.bytesRead;
    expect(used).toBeLessThan((used + remaining) / 10);
  });
});
