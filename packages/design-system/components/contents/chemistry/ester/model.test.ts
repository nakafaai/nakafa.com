import { describe, expect, it } from "@effect/vitest";
import { evaluateEsterReflux } from "@repo/design-system/components/contents/chemistry/ester/model";

describe("esterification reflux model", () => {
  it("starts reflux at warm bath temperatures and orders ester boiling points by chain length", () => {
    const cold = evaluateEsterReflux("ethylEthanoate", 30);
    const hot = evaluateEsterReflux("ethylEthanoate", 80);
    const propyl = evaluateEsterReflux("propylEthanoate", 80);
    const butyl = evaluateEsterReflux("butylEthanoate", 80);

    expect(cold.refluxing).toBe(false);
    expect(hot.refluxing).toBe(true);
    expect(hot.esterLayerRatio).toBeGreaterThan(cold.esterLayerRatio);
    expect(butyl.boilingPointC).toBeGreaterThan(propyl.boilingPointC);
  });
});
