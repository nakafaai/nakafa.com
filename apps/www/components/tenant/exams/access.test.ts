import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import { canOpenExams } from "@/components/tenant/exams/access";
import type { ViewerUnit } from "@/components/tenant/exams/create";

/** The school's view that the exam gate reads: the actions in the school and its units. */
type View = Parameters<typeof canOpenExams>[0];

const unitId = Schema.decodeUnknownSync(Id("tenantUnits"));

/** One unit of the school as the viewer sees it, with the actions the viewer may take in it. */
const unit = (
  can: ViewerUnit["can"],
  status: ViewerUnit["status"] = "active"
): ViewerUnit => ({
  can,
  contentLanguage: "id",
  id: unitId("kelas"),
  level: "sd",
  name: "Kelas",
  status,
  timeZone: "Asia/Jakarta",
});

/** The school as the viewer sees it, with the actions the viewer may take in the school. */
const viewer = (can: View["can"], units: View["units"] = []): View => ({
  can,
  units,
});

describe("canOpenExams", () => {
  it("opens the exams to the Owner, the Admin, and a teacher who may view exams across the school", () => {
    expect(
      canOpenExams(viewer(["exam.view", "exam.edit", "tenant.manage"]))
    ).toBe(true);
  });

  it("opens the exams to a teacher of one unit", () => {
    expect(
      canOpenExams(viewer(["tenant.view"], [unit(["exam.view", "exam.edit"])]))
    ).toBe(true);
  });

  it("opens the exams to a teacher whose only unit is archived, since an archived unit keeps its reads", () => {
    expect(
      canOpenExams(viewer(["tenant.view"], [unit(["exam.view"], "archived")]))
    ).toBe(true);
  });

  it("keeps the exams from a principal, who may view no exam", () => {
    expect(
      canOpenExams(
        viewer(
          ["tenant.view", "person.view"],
          [unit(["unit.view", "period.view"])]
        )
      )
    ).toBe(false);
  });

  it("keeps the exams from a student", () => {
    expect(canOpenExams(viewer(["tenant.view"]))).toBe(false);
  });

  it("keeps the exams from a viewer with no action in the school or its units", () => {
    expect(canOpenExams(viewer([]))).toBe(false);
  });
});
