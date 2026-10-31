import { GroupSpec, Refs, Spec } from "@confect/core";
import users_queries from "../../users/queries.spec";

const spec: Spec.Spec<{
  readonly users: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "users", never, GroupSpec.NamedAt<typeof users_queries, "queries">>, "users">;
}> = Spec.fromGroups({ ["users"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["queries"]: users_queries }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.internal.users;
