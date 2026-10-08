import { GroupSpec, Refs, Spec } from "@confect/core";
import auth_deletion from "../../auth/deletion.spec";
import auth_queries from "../../auth/queries.spec";

const spec: Spec.Spec<{
  readonly auth: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "auth", never, GroupSpec.NamedAt<typeof auth_deletion, "deletion"> | GroupSpec.NamedAt<typeof auth_queries, "queries">>, "auth">;
}> = Spec.make().addAt("auth", GroupSpec.makeAt("auth").addGroupAt("deletion", auth_deletion).addGroupAt("queries", auth_queries));

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.auth;
