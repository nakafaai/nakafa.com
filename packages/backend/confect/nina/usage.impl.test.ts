import { Ref } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { languageModel } from "@repo/backend/confect/gateway/model";
import { createNinaTest } from "@repo/backend/test/nina";

const record = Ref.getFunctionReference(refs.internal.nina.usage.record);
const recover = Ref.getFunctionReference(refs.internal.nina.lifecycle.recover);

/** One answer call's usage, before any gateway cost is attached. */
const call = {
  agent: "nina" as const,
  model: languageModel.id,
  provider: "convexGateway.chat",
  input: 12,
  output: 4,
};

type Fixture = Awaited<ReturnType<typeof createNinaTest>>;

/** The usage rows a turn holds after its calls are recorded. */
function readUsage(fixture: Fixture) {
  return fixture.t.query(
    async (ctx) => (await ctx.db.get("ninaTurns", fixture.turnId))?.usage
  );
}

/** The turn as it is stored. */
function readTurn(fixture: Fixture) {
  return fixture.t.query((ctx) => ctx.db.get("ninaTurns", fixture.turnId));
}

/** What one call of `record` reads and writes, as its own transaction counts it. */
function measure(fixture: Fixture) {
  return fixture.t.mutation(async (ctx) => {
    await ctx.runMutation(record, { turnId: fixture.turnId, usage: call });
    return ctx.meta.getTransactionMetrics();
  });
}

describe("Nina usage ledger", () => {
  it("loads the turn once and writes it back whole, which reads it one more time and no more", async () => {
    const fixture = await createNinaTest();
    const metrics = await measure(fixture);
    // A `patch` read the row a third time and made a second database query.
    expect(metrics.documentsRead.used).toBe(2);
    expect(metrics.databaseQueries.used).toBe(1);
    expect(metrics.documentsWritten.used).toBe(1);
  });

  it("changes the ledger of the turn and nothing else it stores", async () => {
    const fixture = await createNinaTest();
    const before = await readTurn(fixture);
    await fixture.t.mutation(record, { turnId: fixture.turnId, usage: call });
    expect(await readTurn(fixture)).toEqual({
      ...before,
      usage: [{ ...call, calls: 1 }],
    });
  });

  it("counts a call that arrives after the turn settled in the tokens of the settled turn", async () => {
    const fixture = await createNinaTest();
    await fixture.t.mutation(recover, { turnId: fixture.turnId });
    const settled = await readTurn(fixture);
    expect(settled).toMatchObject({ phase: "settled" });
    await fixture.t.mutation(record, { turnId: fixture.turnId, usage: call });
    expect(await readTurn(fixture)).toEqual({
      ...settled,
      tokens: { input: 12, output: 4, total: 16 },
      usage: [{ ...call, calls: 1 }],
    });
  });

  it("records nothing for a turn that is gone", async () => {
    const fixture = await createNinaTest();
    await fixture.t.mutation((ctx) =>
      ctx.db.delete("ninaTurns", fixture.turnId)
    );
    const metrics = await measure(fixture);
    expect(metrics.documentsWritten.used).toBe(0);
    expect(await readTurn(fixture)).toBeNull();
  });

  it("keeps a call without a reported cost unpriced", async () => {
    const fixture = await createNinaTest();
    await fixture.t.mutation(record, { turnId: fixture.turnId, usage: call });
    expect(await readUsage(fixture)).toEqual([{ ...call, calls: 1 }]);
  });

  it("adds the cost of every call to its row", async () => {
    const fixture = await createNinaTest();
    await fixture.t.mutation(record, {
      turnId: fixture.turnId,
      usage: { ...call, cost: 0.25 },
    });
    await fixture.t.mutation(record, {
      turnId: fixture.turnId,
      usage: { ...call, cost: 0.5 },
    });
    expect(await readUsage(fixture)).toEqual([
      { ...call, input: 24, output: 8, calls: 2, cost: 0.75 },
    ]);
  });

  it("keeps the cost a row holds when a later call reports none", async () => {
    const fixture = await createNinaTest();
    await fixture.t.mutation(record, {
      turnId: fixture.turnId,
      usage: { ...call, cost: 0.25 },
    });
    await fixture.t.mutation(record, { turnId: fixture.turnId, usage: call });
    expect(await readUsage(fixture)).toEqual([
      { ...call, input: 24, output: 8, calls: 2, cost: 0.25 },
    ]);
  });

  it("starts a row's cost when a later call reports the first one", async () => {
    const fixture = await createNinaTest();
    await fixture.t.mutation(record, { turnId: fixture.turnId, usage: call });
    await fixture.t.mutation(record, {
      turnId: fixture.turnId,
      usage: { ...call, cost: 0.5 },
    });
    expect(await readUsage(fixture)).toEqual([
      { ...call, input: 24, output: 8, calls: 2, cost: 0.5 },
    ]);
  });

  it("adds the cached and reasoning tokens of every call to its row", async () => {
    const fixture = await createNinaTest();
    await fixture.t.mutation(record, {
      turnId: fixture.turnId,
      usage: { ...call, cached: 0, reasoning: 2 },
    });
    await fixture.t.mutation(record, {
      turnId: fixture.turnId,
      usage: { ...call, cached: 9, reasoning: 1 },
    });
    expect(await readUsage(fixture)).toEqual([
      { ...call, input: 24, output: 8, calls: 2, cached: 9, reasoning: 3 },
    ]);
  });

  it("never invents a cached or reasoning count that no call reported", async () => {
    const fixture = await createNinaTest();
    await fixture.t.mutation(record, { turnId: fixture.turnId, usage: call });
    await fixture.t.mutation(record, { turnId: fixture.turnId, usage: call });
    const [row] = (await readUsage(fixture)) ?? [];
    expect(row).not.toHaveProperty("cached");
    expect(row).not.toHaveProperty("reasoning");
  });
});
