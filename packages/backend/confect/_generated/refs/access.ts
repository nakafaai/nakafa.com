import { GroupSpec, Refs, Spec } from "@confect/core";
import access_grants from "../../access/grants.spec";

const spec: Spec.Spec<{
  readonly access: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "access", never, GroupSpec.NamedAt<typeof access_grants, "grants">>, "access">;
}> = Spec.fromGroups({ ["access"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["grants"]: access_grants }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.access;
