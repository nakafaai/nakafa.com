import {
  AUDIT_INVENTORY,
  RETIRED_PROGRAM_INVENTORY,
} from "@repo/backend/convex/contentRelease/cutover/inventory";
import { RETIRED_PROGRAM_ZERO_RECEIPT } from "@repo/backend/convex/contentRelease/cutover/retiredPrograms";
import { describe, expect, it } from "vitest";

describe("contentRelease/cutover/inventory", () => {
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
