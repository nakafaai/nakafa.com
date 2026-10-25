import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import { scopeNameOf } from "@/components/tenant/settings/scope";

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
});
