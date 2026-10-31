import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import type { ViewerUnit } from "@/components/tenant/exams/create";
import { canOpenGraduation } from "@/components/tenant/graduation/access";

const unitId = Schema.decodeUnknownSync(Id("tenantUnits"));

/** One unit of the school as the viewer sees it, with the actions the viewer may take in it. */
const unit = (can: ViewerUnit["can"]): ViewerUnit => ({
  can,
  contentLanguage: "id",
  id: unitId("smp"),
  level: "smp",
  name: "SMP Nakafa",
  status: "active",
  timeZone: "Asia/Jakarta",
});

describe("canOpenGraduation", () => {
  it("opens the graduation pages to a viewer who holds graduation open in one unit", () => {
    expect(canOpenGraduation({ units: [] })).toBe(false);
    expect(canOpenGraduation({ units: [unit(["report.open"])] })).toBe(false);
    expect(
      canOpenGraduation({
        units: [unit(["report.open"]), unit(["graduation.open"])],
      })
    ).toBe(true);
  });
});
