import { GroupSpec, Refs, Spec } from "@confect/core";
import records_prints from "../../records/prints.spec";

const spec: Spec.Spec<{
  readonly records: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "records", never, GroupSpec.NamedAt<typeof records_prints, "prints">>, "records">;
}> = Spec.fromGroups({ ["records"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["prints"]: records_prints }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.internal.records;
