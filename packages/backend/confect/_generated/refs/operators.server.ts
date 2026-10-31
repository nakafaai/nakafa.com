import { GroupSpec, Refs, Spec } from "@confect/core";
import operators_expiry from "../../operators/expiry.spec";
import operators_staff from "../../operators/staff.spec";

const spec: Spec.Spec<{
  readonly operators: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "operators", never, GroupSpec.NamedAt<typeof operators_expiry, "expiry"> | GroupSpec.NamedAt<typeof operators_staff, "staff">>, "operators">;
}> = Spec.fromGroups({ ["operators"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["expiry"]: operators_expiry, ["staff"]: operators_staff }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.internal.operators;
