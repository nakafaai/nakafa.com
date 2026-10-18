import { GroupSpec, Refs, Spec } from "@confect/core";
import records_grades from "../../records/grades.spec";

const spec: Spec.Spec<{
  readonly records: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "records", never, GroupSpec.NamedAt<typeof records_grades, "grades">>, "records">;
}> = Spec.fromGroups({ ["records"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["grades"]: records_grades }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.records;
