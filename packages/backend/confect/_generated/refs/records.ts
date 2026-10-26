import { GroupSpec, Refs, Spec } from "@confect/core";
import records_checks from "../../records/checks.spec";
import records_grades from "../../records/grades.spec";
import records_reports from "../../records/reports.spec";
import records_schemes from "../../records/schemes.spec";

const spec: Spec.Spec<{
  readonly records: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "records", never, GroupSpec.NamedAt<typeof records_checks, "checks"> | GroupSpec.NamedAt<typeof records_grades, "grades"> | GroupSpec.NamedAt<typeof records_reports, "reports"> | GroupSpec.NamedAt<typeof records_schemes, "schemes">>, "records">;
}> = Spec.fromGroups({ ["records"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["checks"]: records_checks, ["grades"]: records_grades, ["reports"]: records_reports, ["schemes"]: records_schemes }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.records;
