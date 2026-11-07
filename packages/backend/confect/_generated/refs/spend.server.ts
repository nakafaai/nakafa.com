import { GroupSpec, Refs, Spec } from "@confect/core";
import spend_escrow from "../../spend/escrow.spec";

const spec: Spec.Spec<{
  readonly spend: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "spend", never, GroupSpec.NamedAt<typeof spend_escrow, "escrow">>, "spend">;
}> = Spec.fromGroups({ ["spend"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["escrow"]: spend_escrow }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.internal.spend;
