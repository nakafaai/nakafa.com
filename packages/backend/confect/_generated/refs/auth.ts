import { GroupSpec, Refs, Spec } from "@confect/core";
import auth_core from "../../auth/core.spec";
import auth_deletion from "../../auth/deletion.spec";
import auth_grant from "../../auth/grant.spec";
import auth_queries from "../../auth/queries.spec";
import auth_school from "../../auth/school.spec";

const spec: Spec.Spec<{
  readonly auth: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "auth", never, GroupSpec.NamedAt<typeof auth_core, "core"> | GroupSpec.NamedAt<typeof auth_deletion, "deletion"> | GroupSpec.NamedAt<typeof auth_grant, "grant"> | GroupSpec.NamedAt<typeof auth_queries, "queries"> | GroupSpec.NamedAt<typeof auth_school, "school">>, "auth">;
}> = Spec.fromGroups({ ["auth"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["core"]: auth_core, ["deletion"]: auth_deletion, ["grant"]: auth_grant, ["queries"]: auth_queries, ["school"]: auth_school }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.auth;
