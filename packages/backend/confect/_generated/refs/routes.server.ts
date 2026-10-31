import { GroupSpec, Refs, Spec } from "@confect/core";
import routes_agent_quota from "../../routes/agent/quota.spec";

const spec: Spec.Spec<{
  readonly routes: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "routes", never, GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "agent", never, GroupSpec.NamedAt<typeof routes_agent_quota, "quota">>, "agent">>, "routes">;
}> = Spec.fromGroups({ ["routes"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["agent"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["quota"]: routes_agent_quota }) }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.internal.routes;
