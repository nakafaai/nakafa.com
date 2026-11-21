// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  barShare,
  firstLawTex,
  PROCESS_LAW,
  signOf,
  signTex,
  valueTex,
} from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/ledger";

/** How each process's law opens: with the quantity the process holds fixed. */
const FIXED = {
  adiabatic: /^Q = 0 /u,
  isobaric: /^p_1 = p_2 /u,
  isochoric: /^V_1 = V_2 /u,
  isothermal: /^T_1 = T_2 /u,
} as const;

/** Writes a number as the Indonesian card does, with a decimal comma. */
const comma = (value: number) => String(value).replace(".", "{,}");

describe("the energy bars", () => {
  it("reads a float's leftover from a zero as no energy", () => {
    expect(signOf(1e-10, 1000)).toBe(0);
    expect(signOf(2, 1000)).toBe(1);
    expect(signOf(-2, 1000)).toBe(-1);
  });

  it("reaches as far as the energy against the lab's largest", () => {
    expect(barShare(250, 1000)).toBe(0.25);
    expect(barShare(-500, 1000)).toBe(0.5);
    expect(barShare(1e-10, 1000)).toBe(0);
    expect(barShare(1500, 1000)).toBe(1);
  });

  it("writes an energy as its sign alone, or with its number in joules", () => {
    expect(signTex("Q", 400, 1000)).toBe("Q > 0");
    expect(signTex("\\Delta U", -400, 1000)).toBe("\\Delta U < 0");
    expect(signTex("W", 0, 1000)).toBe("W = 0");
    expect(valueTex("Q", 415.5, 1000, comma)).toBe("Q = 415{,}5\\text{ J}");
    expect(valueTex("\\Delta U", 1e-12, 1000, comma)).toBe(
      "\\Delta U = 0\\text{ J}"
    );
  });
});

describe("the laws", () => {
  it("states the quantity each process holds fixed, then the rule it gives", () => {
    expect(PROCESS_LAW.isobaric).toMatch(FIXED.isobaric);
    expect(PROCESS_LAW.isochoric).toMatch(FIXED.isochoric);
    expect(PROCESS_LAW.isothermal).toMatch(FIXED.isothermal);
    expect(PROCESS_LAW.adiabatic).toMatch(FIXED.adiabatic);
    expect(PROCESS_LAW.isochoric).toContain("W = 0");
    expect(PROCESS_LAW.isothermal).toContain("\\Delta U = 0");
    expect(PROCESS_LAW.isobaric).toContain("V_2 - V_1");
  });

  it("works the first law through with the numbers, bracketing work done on the gas", () => {
    expect(
      firstLawTex({ heat: 1250, internal: 750, work: 500 }, 2500, comma)
    ).toBe("\\Delta U = Q - W = 1250 - 500 = 750\\text{ J}");
    expect(
      firstLawTex({ heat: 0, internal: 340.5, work: -340.5 }, 2500, comma)
    ).toBe("\\Delta U = Q - W = 0 - (-340{,}5) = 340{,}5\\text{ J}");
    expect(
      firstLawTex({ heat: 600, internal: 1e-13, work: 600 }, 2500, comma)
    ).toBe("\\Delta U = Q - W = 600 - 600 = 0\\text{ J}");
  });
});
