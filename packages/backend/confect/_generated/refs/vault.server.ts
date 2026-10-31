import { GroupSpec, Refs, Spec } from "@confect/core";
import vault_keys from "../../vault/keys.spec";

const spec: Spec.Spec<{
  readonly vault: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "vault", never, GroupSpec.NamedAt<typeof vault_keys, "keys">>, "vault">;
}> = Spec.fromGroups({ ["vault"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["keys"]: vault_keys }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.internal.vault;
