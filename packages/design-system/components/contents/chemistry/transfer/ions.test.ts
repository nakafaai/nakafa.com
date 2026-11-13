import { describe, expect, it } from "@effect/vitest";
import {
  getPair,
  ionTex,
  PairIdSchema,
  shellsAfterGain,
  shellsAfterLoss,
  shellsTex,
} from "@repo/design-system/components/contents/chemistry/transfer/ions";
import { Array as Arr } from "effect";

describe("ion formation", () => {
  it("leaves both ions with a full outer shell of the nearest noble gas", () => {
    for (const id of PairIdSchema.literals) {
      const pair = getPair(id);
      const metal = shellsAfterLoss(pair.metal.shells, pair.electrons);
      const nonmetal = shellsAfterGain(pair.nonmetal.shells, pair.electrons);
      const full = (shells: readonly number[]) =>
        Arr.last(shells).pipe(
          (last) =>
            last._tag === "Some" &&
            (last.value === 8 || (shells.length === 1 && last.value === 2))
        );

      expect(full(metal)).toBe(true);
      expect(full(nonmetal)).toBe(true);
    }
  });

  it("shrinks every metal and swells every nonmetal as it becomes an ion", () => {
    for (const id of PairIdSchema.literals) {
      const pair = getPair(id);
      expect(pair.metal.ionic).toBeLessThan(pair.metal.atomic);
      expect(pair.nonmetal.ionic).toBeGreaterThan(pair.nonmetal.atomic);
    }
  });

  it("keeps a partly emptied outer shell", () => {
    expect(shellsAfterLoss([2, 8, 3], 1)).toEqual([2, 8, 2]);
    expect(shellsAfterLoss([], 1)).toEqual([]);
  });

  it("writes configurations and ions as math", () => {
    expect(shellsTex([2, 8, 1])).toBe("2,8,1");
    expect(ionTex("Na", 1)).toBe("\\mathrm{Na^{+}}");
    expect(ionTex("O", -2)).toBe("\\mathrm{O^{2-}}");
  });
});
