import { describe, expect, it } from "@effect/vitest";
import {
  anodeOf,
  cathodeOf,
  dischargedIon,
  gasVolume,
  ionsOf,
  phTrend,
  productMass,
  productMoles,
  tintOf,
} from "@repo/design-system/components/contents/chemistry/electrolysis/cell";

describe("electrolysis cell", () => {
  it("deposits copper and releases oxygen from copper(II) sulfate on carbon, and the pH falls", () => {
    const cell = {
      electrode: "carbon",
      electrolyte: "copper-sulfate",
    } as const;
    const cathode = cathodeOf(cell);
    const anode = anodeOf(cell);

    expect(cathode).toMatchObject({ change: "deposit", product: "copper" });
    expect(anode).toMatchObject({ change: "gas", product: "oxygen" });
    expect(dischargedIon(anode)).toBe("hydroxide");
    expect(phTrend(cell)).toBe("falls");
    expect(tintOf(cell.electrolyte)).toBe("blue");
    // SPM Kimia set 1, question 23: 0.64 g of copper passes 0.020 mol of electrons.
    expect(productMass(cathode, 0.02)).toBeCloseTo(0.64, 10);
    expect(gasVolume(anode, 0.02, 24_000)).toBeCloseTo(120, 10);
  });

  it("dissolves a copper anode in its own ions, so the pH holds", () => {
    const cell = {
      electrode: "copper",
      electrolyte: "copper-sulfate",
    } as const;
    const anode = anodeOf(cell);

    expect(anode).toMatchObject({ change: "dissolves", product: "copper" });
    expect(dischargedIon(anode)).toBeNull();
    expect(phTrend(cell)).toBe("steady");
  });

  it("dissolves a silver anode in silver nitrate and deposits silver at the cathode", () => {
    const cell = {
      electrode: "silver",
      electrolyte: "silver-nitrate",
    } as const;

    expect(anodeOf(cell)).toMatchObject({
      change: "dissolves",
      product: "silver",
    });
    expect(cathodeOf(cell)).toMatchObject({
      change: "deposit",
      product: "silver",
    });
    // SPM Kimia set 1, question 25: 2.16 g of silver passes 0.020 mol of electrons.
    expect(productMoles(cathodeOf(cell), 0.02)).toBeCloseTo(0.02, 10);
    expect(productMass(cathodeOf(cell), 0.02)).toBeCloseTo(2.16, 10);
  });

  it("treats a metal anode outside its own ions as inert", () => {
    const cell = {
      electrode: "copper",
      electrolyte: "silver-nitrate",
    } as const;

    expect(anodeOf(cell)).toMatchObject({ change: "gas", product: "oxygen" });
    expect(tintOf(cell.electrolyte)).toBe("clear");
  });

  it("discharges chloride only when it is concentrated, and then the pH rises", () => {
    const concentrated = {
      electrode: "carbon",
      electrolyte: "sodium-chloride-concentrated",
    } as const;
    const dilute = {
      electrode: "carbon",
      electrolyte: "sodium-chloride-dilute",
    } as const;

    expect(anodeOf(concentrated).product).toBe("chlorine");
    expect(dischargedIon(anodeOf(concentrated))).toBe("chloride");
    expect(phTrend(concentrated)).toBe("rises");
    expect(anodeOf(dilute).product).toBe("oxygen");
    expect(cathodeOf(dilute).product).toBe("hydrogen");
    expect(dischargedIon(cathodeOf(dilute))).toBe("hydrogen");
    expect(phTrend(dilute)).toBe("steady");
    expect(ionsOf(dilute.electrolyte)).toEqual([
      "sodium",
      "hydrogen",
      "chloride",
      "hydroxide",
    ]);
  });

  it("concentrates sulfuric acid, so its pH falls", () => {
    const cell = {
      electrode: "platinum",
      electrolyte: "sulfuric-acid",
    } as const;

    expect(cathodeOf(cell).product).toBe("hydrogen");
    expect(phTrend(cell)).toBe("falls");
    expect(
      dischargedIon(
        cathodeOf({ electrode: "carbon", electrolyte: "silver-nitrate" })
      )
    ).toBe("silver");
    expect(
      dischargedIon(
        cathodeOf({ electrode: "carbon", electrolyte: "copper-sulfate" })
      )
    ).toBe("copper");
  });
});
