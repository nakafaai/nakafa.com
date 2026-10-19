import { GroupSpec, Refs, Spec } from "@confect/core";
import connectors_connections from "../../connectors/connections.spec";

const spec: Spec.Spec<{
  readonly connectors: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "connectors", never, GroupSpec.NamedAt<typeof connectors_connections, "connections">>, "connectors">;
}> = Spec.fromGroups({ ["connectors"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["connections"]: connectors_connections }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.connectors;
