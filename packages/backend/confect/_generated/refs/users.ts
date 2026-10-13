import { GroupSpec, Refs, Spec } from "@confect/core";
import users_mutations from "../../users/mutations.spec";
import users_queries from "../../users/queries.spec";

const spec: Spec.Spec<{
  readonly users: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "users", never, GroupSpec.NamedAt<typeof users_mutations, "mutations"> | GroupSpec.NamedAt<typeof users_queries, "queries">>, "users">;
}> = Spec.make().addAt("users", GroupSpec.makeAt("users").addGroupAt("mutations", users_mutations).addGroupAt("queries", users_queries));

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.users;
