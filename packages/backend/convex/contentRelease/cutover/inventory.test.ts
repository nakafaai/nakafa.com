import {
  AUDIT_INVENTORY,
  AUDITED_ACTIVE_TRYOUT_CATALOG_COUNT,
  AUDITED_PHYSICAL_TRYOUT_CATALOG_COUNT,
  CURRENT_INVENTORY,
  RETIRED_PROGRAM_INVENTORY,
} from "@repo/backend/convex/contentRelease/cutover/inventory";
import { RETIRED_PROGRAM_ZERO_RECEIPT } from "@repo/backend/convex/contentRelease/cutover/retiredPrograms";
import { describe, expect, it } from "vitest";

describe("contentRelease/cutover/inventory", () => {
  it("separates the active signed try-out catalog from physical retention", () => {
    const tryoutCatalog = CURRENT_INVENTORY.find(
      ({ table }) => table === "tryoutCatalog"
    );

    expect(AUDITED_ACTIVE_TRYOUT_CATALOG_COUNT).toBe(54);
    expect(AUDITED_PHYSICAL_TRYOUT_CATALOG_COUNT).toBe(108);
    expect(tryoutCatalog?.expected).toBe(AUDITED_PHYSICAL_TRYOUT_CATALOG_COUNT);
  });

  it("requires every retired synthetic program table to stay empty", () => {
    expect(RETIRED_PROGRAM_INVENTORY).toEqual([
      { batchSize: 1, expected: 0, table: "learningProgramCoverage" },
      { batchSize: 1, expected: 0, table: "learningProgramSources" },
      { batchSize: 1, expected: 0, table: "learningPrograms" },
      { batchSize: 1, expected: 0, table: "learningPlanItems" },
      { batchSize: 1, expected: 0, table: "learningPlans" },
      { batchSize: 1, expected: 0, table: "learningProfiles" },
    ]);
    const auditedTables = AUDIT_INVENTORY.map(({ table }) => table);
    for (const { table } of RETIRED_PROGRAM_INVENTORY) {
      expect(auditedTables).not.toContain(table);
      expect(RETIRED_PROGRAM_ZERO_RECEIPT[table]).toBe(0);
    }
    expect(Object.keys(RETIRED_PROGRAM_ZERO_RECEIPT)).toHaveLength(
      RETIRED_PROGRAM_INVENTORY.length + 1
    );
  });
});
