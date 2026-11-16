// convex-test imports a function's module on its first call, which is slow on a loaded machine.
import "@repo/backend/convex/spend/escrow";
import { describe, expect, it } from "@effect/vitest";
import { FOLD_BATCH, holdSpend } from "@repo/backend/confect/spend/ledger";
import { internal } from "@repo/backend/convex/_generated/api";
import {
  createBillingTestConvex,
  runInMutation,
} from "@repo/backend/test/billing";
import { Array as Arr } from "effect";

describe("spend/escrow fold", () => {
  it("counts a burst larger than one fold by running the next fold at once", async () => {
    vi.useFakeTimers();
    const t = createBillingTestConvex();
    await t.run(async (ctx) => {
      for (const _ of Arr.range(0, FOLD_BATCH)) {
        await runInMutation(ctx, holdSpend({ kind: "nakafa" }, "embedding", 1));
      }
    });
    await t.mutation(internal.spend.escrow.fold, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const rows = await t.run((ctx) => ctx.db.query("vendorSpend").collect());
    expect(Arr.map(rows, ({ calls, held }) => ({ calls, held }))).toEqual([
      { calls: FOLD_BATCH + 1, held: FOLD_BATCH + 1 },
    ]);
    vi.useRealTimers();
  });
});
