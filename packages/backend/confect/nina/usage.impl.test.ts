import { Ref } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { createNinaTest } from "@repo/backend/test/nina";

const record = Ref.getFunctionReference(refs.internal.nina.usage.record);

/** One answer call's usage, before any gateway cost is attached. */
const call = {
  agent: "nina" as const,
  model: "google/gemini-3.7-flash",
  provider: "convexGateway.chat",
  input: 12,
  output: 4,
};

/** The usage rows a turn holds after its calls are recorded. */
function readUsage(fixture: Awaited<ReturnType<typeof createNinaTest>>) {
  return fixture.t.query(
    async (ctx) => (await ctx.db.get("ninaTurns", fixture.turnId))?.usage
  );
}

describe("Nina usage ledger", () => {
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
});
