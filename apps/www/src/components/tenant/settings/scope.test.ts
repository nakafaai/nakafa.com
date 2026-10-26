import { describe, expect, it } from "@effect/vitest";
import { School01Icon } from "@hugeicons/core-free-icons";
import { Id } from "@repo/backend/confect/_generated/id";
import { Array as Arr, Schema } from "effect";
import { scopeNameOf, scopeOptions } from "@/components/tenant/settings/scope";

const smp = Schema.decodeUnknownSync(Id("tenantUnits"))("unit-smp");
const sma = Schema.decodeUnknownSync(Id("tenantUnits"))("unit-sma");
const units = [{ id: smp, name: "SMP Nakafa" }];

describe("components/tenant/settings/scope", () => {
  it("names the whole school for a scope that covers the school", () => {
    expect(scopeNameOf({ kind: "tenant" }, "Sekolah Nakafa", units)).toBe(
      "Sekolah Nakafa"
    );
  });

  it("names the unit for a scope that covers one unit", () => {
    expect(
      scopeNameOf({ kind: "unit", unitId: smp }, "Sekolah Nakafa", units)
    ).toBe("SMP Nakafa");
  });

  it("names nothing for a unit the school does not hold", () => {
    expect(
      scopeNameOf({ kind: "unit", unitId: sma }, "Sekolah Nakafa", units)
    ).toBe("");
  });

  it("lists the school first with its icon, then each unit once with an icon of its own", () => {
    const options = scopeOptions("Sekolah Nakafa", [
      { name: "SMP Nakafa" },
      { name: "SMA Nakafa" },
      { name: "SMP Nakafa" },
      { name: "Sekolah Nakafa" },
    ]);

    expect(Arr.map(options, ({ value }) => value)).toEqual([
      "Sekolah Nakafa",
      "SMP Nakafa",
      "SMA Nakafa",
    ]);
    expect(options[0]?.icon).toBe(School01Icon);
    expect(Arr.dedupe(Arr.map(options, ({ icon }) => icon))).toHaveLength(3);
  });
});
