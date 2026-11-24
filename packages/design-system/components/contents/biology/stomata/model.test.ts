import { describe, expect, it } from "@effect/vitest";
import { evaluateStomata } from "@repo/design-system/components/contents/biology/stomata/model";

describe("stomatal guard cell model", () => {
  it("opens guard cells widely under bright light and narrows under dim light", () => {
    const bright = evaluateStomata("light", 80, 0, 100);
    const dim = evaluateStomata("light", 15, 0, 100);
    const zero = evaluateStomata("light", 0, 0, 100);

    expect(bright.aperture).toBe("open");
    expect(bright.turgor).toBe("turgid");
    expect(bright.co2Percent).toBeGreaterThan(dim.co2Percent);
    expect(dim.aperture).toBe("narrow");
    expect(dim.turgor).toBe("turgid");
    expect(zero.aperture).toBe("closed");
    expect(zero.turgor).toBe("flaccid");
  });

  it("closes stomata and lowers transpiration in darkness and drought", () => {
    const dark = evaluateStomata("dark", 80, 0, 100);
    const drought = evaluateStomata("drought", 100, 0, 100);

    expect(dark.aperture).toBe("closed");
    expect(dark.turgor).toBe("flaccid");
    expect(dark.transpirationPercent).toBe(6);

    expect(drought.aperture).toBe("closed");
    expect(drought.turgor).toBe("flaccid");
    expect(drought.transpirationPercent).toBe(3);
  });
});
