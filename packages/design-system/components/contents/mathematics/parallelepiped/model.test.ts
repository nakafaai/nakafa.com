import { describe, expect, it } from "@effect/vitest";
import { evaluateParallelepiped } from "@repo/design-system/components/contents/mathematics/parallelepiped/model";

describe("vector parallelepiped triple product model", () => {
  it("maximizes volume when orthogonal and collapses to zero when coplanar", () => {
    const box = evaluateParallelepiped("orthogonalBox", 90);
    const sheared = evaluateParallelepiped("shearedPrism", 60);
    const flat = evaluateParallelepiped("coplanarFlat", 60);

    expect(box.volume).toBe(4.5);
    expect(box.coplanar).toBe(false);
    expect(sheared.volume).toBeLessThan(box.volume);
    expect(flat.volume).toBe(0);
    expect(flat.coplanar).toBe(true);
  });
});
