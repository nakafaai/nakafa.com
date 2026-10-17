import { GroupSpec, Refs, Spec } from "@confect/core";
import operators_tenants from "../../operators/tenants.spec";
import operators_visits from "../../operators/visits.spec";

const spec: Spec.Spec<{
  readonly operators: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "operators", never, GroupSpec.NamedAt<typeof operators_tenants, "tenants"> | GroupSpec.NamedAt<typeof operators_visits, "visits">>, "operators">;
}> = Spec.fromGroups({ ["operators"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["tenants"]: operators_tenants, ["visits"]: operators_visits }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.operators;
