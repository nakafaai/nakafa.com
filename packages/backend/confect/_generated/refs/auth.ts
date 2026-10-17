import { GroupSpec, Refs, Spec } from "@confect/core";
import auth_deletion from "../../auth/deletion.spec";
import auth_queries from "../../auth/queries.spec";

const spec: Spec.Spec<{
  readonly auth: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "auth", never, GroupSpec.NamedAt<typeof auth_deletion, "deletion"> | GroupSpec.NamedAt<typeof auth_queries, "queries">>, "auth">;
}> = Spec.fromGroups({ ["auth"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["deletion"]: auth_deletion, ["queries"]: auth_queries }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.auth;
