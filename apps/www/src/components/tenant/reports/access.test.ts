import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import type { ViewerUnit } from "@/components/tenant/exams/create";
import { canOpenReports, menuOf } from "@/components/tenant/reports/access";
import type { ReportLine } from "@/components/tenant/reports/change";

const unitId = Schema.decodeUnknownSync(Id("tenantUnits"));

/** One unit of the school as the viewer sees it, with the actions the viewer may take in it. */
const unit = (can: ViewerUnit["can"]): ViewerUnit => ({
  can,
  contentLanguage: "id",
  id: unitId("kelas"),
  level: "smp",
  name: "Kelas",
  status: "active",
  timeZone: "Asia/Jakarta",
});

describe("canOpenReports", () => {
  it("opens the report pages to a viewer who holds the open action in one unit", () => {
    expect(canOpenReports({ units: [] })).toBe(false);
    expect(canOpenReports({ units: [unit(["exam.view"])] })).toBe(false);
    expect(
      canOpenReports({ units: [unit(["exam.view"]), unit(["report.open"])] })
    ).toBe(true);
  });
});

/** A line of a report list with the report in `state`, or none, and what the viewer may do. */
const line = (
  state: "none" | "draft" | "completed" | "approved" | "locked",
  can: ReportLine["can"]
): ReportLine => ({
  can,
  report:
    state === "none"
      ? null
      : {
          approvedAt: null,
          hash: null,
          id: Schema.decodeUnknownSync(Id("reportCards"))("report"),
          note: "",
          state,
        },
  student: {
    id: Schema.decodeUnknownSync(Id("tenantPeople"))("raka"),
    name: "Raka",
  },
});

describe("menuOf", () => {
  it("offers the homeroom teacher the note and the hand-in of a draft, and taking back a handed-in report", () => {
    const homeroom: ReportLine["can"] = ["report.complete", "report.write"];
    expect(menuOf(line("none", ["report.write"]))).toEqual({
      approve: false,
      complete: false,
      open: false,
      reopen: false,
      write: true,
    });
    expect(menuOf(line("draft", homeroom))).toMatchObject({
      complete: true,
      write: true,
    });
    expect(menuOf(line("completed", homeroom))).toMatchObject({
      complete: false,
      reopen: true,
      write: false,
    });
  });

  it("offers the principal the approval of a handed-in report, and every reader the PDF of a locked one", () => {
    expect(menuOf(line("completed", ["report.approve"]))).toMatchObject({
      approve: true,
    });
    expect(menuOf(line("draft", ["report.approve"]))).toMatchObject({
      approve: false,
    });
    expect(menuOf(line("locked", []))).toMatchObject({
      open: true,
      write: false,
    });
  });
});
