import type { Ref } from "@confect/core";
import type tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { Array as Arr } from "effect";
import type { ReportLine } from "@/components/tenant/reports/change";

/** The viewer's view of the school, as the school layout reads it. */
type Viewer = Ref.Returns<typeof tenancy.viewer.get>;

/**
 * Whether a viewer may open the report pages and the sidebar item: the viewer holds the
 * report open action in one of the school's units, as a teacher, a principal, or an Admin.
 * Which class groups they report on is the server's answer, so this only decides what the
 * school shows.
 */
export const canOpenReports = (viewer: Pick<Viewer, "units">) =>
  Arr.some(viewer.units, (unit) => Arr.contains(unit.can, "report.open"));

/**
 * The items a report's row menu shows: write the note while it is not handed in, hand in
 * a draft, take back a handed-in report, approve a handed-in report, and open a locked
 * one. Each needs the action the server allows on the line.
 */
export const menuOf = (line: ReportLine) => {
  const state = line.report?.state ?? "none";
  const may = (action: ReportLine["can"][number]) =>
    Arr.contains(line.can, action);
  return {
    approve: may("report.approve") && state === "completed",
    complete: may("report.complete") && state === "draft",
    open: state === "locked",
    reopen: may("report.complete") && state === "completed",
    write: may("report.write") && (state === "none" || state === "draft"),
  };
};
