// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { evaluateLeChatelier } from "@repo/design-system/components/contents/chemistry/lechatelier/model";

describe("le chatelier lab model", () => {
  it("applies pressure, temperature, concentration, and catalyst rules accurately", () => {
    const haberPressure = evaluateLeChatelier("haber", "pressure", 0.8);
    expect(haberPressure.shift).toBe("forward");
    expect(haberPressure.kcState).toBe("constant");
    expect(haberPressure.yieldPercent).toBeGreaterThan(52);

    const no2Pressure = evaluateLeChatelier("nitrogenDioxide", "pressure", 0.8);
    expect(no2Pressure.shift).toBe("reverse");

    const haberHeat = evaluateLeChatelier("haber", "temperature", 0.8);
    expect(haberHeat.shift).toBe("reverse");
    expect(haberHeat.kcState).toBe("decreases");

    const no2Heat = evaluateLeChatelier("nitrogenDioxide", "temperature", 0.8);
    expect(no2Heat.shift).toBe("forward");
    expect(no2Heat.kcState).toBe("increases");

    const contactCool = evaluateLeChatelier("contact", "temperature", -0.8);
    expect(contactCool.shift).toBe("forward");
    expect(contactCool.kcState).toBe("increases");

    expect(evaluateLeChatelier("haber", "concentration", 0.7).shift).toBe(
      "forward"
    );
    expect(evaluateLeChatelier("haber", "concentration", -0.7).shift).toBe(
      "reverse"
    );
    expect(evaluateLeChatelier("haber", "catalyst", 1)).toEqual({
      kcState: "constant",
      shift: "none",
      yieldPercent: 52,
    });
    expect(evaluateLeChatelier("haber", "pressure", 0).shift).toBe("none");
    expect(evaluateLeChatelier("haber", "temperature", 0).shift).toBe("none");
    expect(evaluateLeChatelier("haber", "concentration", 0).shift).toBe("none");
  });
});
