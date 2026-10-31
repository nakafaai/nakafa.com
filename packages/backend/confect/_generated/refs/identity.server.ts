import { GroupSpec, Refs, Spec } from "@confect/core";
import identity_logins from "../../identity/logins.spec";
import identity_seed from "../../identity/seed.spec";

const spec: Spec.Spec<{
  readonly identity: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "identity", never, GroupSpec.NamedAt<typeof identity_logins, "logins"> | GroupSpec.NamedAt<typeof identity_seed, "seed">>, "identity">;
}> = Spec.fromGroups({ ["identity"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["logins"]: identity_logins, ["seed"]: identity_seed }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.internal.identity;
