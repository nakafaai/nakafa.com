// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { evaluateColumn } from "@repo/design-system/components/contents/biology/lactase/model";

describe("lactase column lab model", () => {
  it("keeps immobilised lactase reusable and enzyme-free while flow rate governs hydrolysis", () => {
    const slow = evaluateColumn("immobilised", 1);
    const fast = evaluateColumn("immobilised", 20);
    expect(slow.enzymeInMilk).toBe(false);
    expect(slow.batches).toBe(12);
    expect(slow.glucosePositive).toBe(true);
    expect(slow.lactoseRemaining).toBeLessThan(fast.lactoseRemaining);

    const free = evaluateColumn("free", 5);
    expect(free.enzymeInMilk).toBe(true);
    expect(free.batches).toBe(1);
    expect(free.glucosePositive).toBe(true);
  });
});
