import { GroupSpec, Refs, Spec } from "@confect/core";
import acceptance_accounts from "../../acceptance/accounts.spec";

const spec: Spec.Spec<{
  readonly acceptance: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "acceptance", never, GroupSpec.NamedAt<typeof acceptance_accounts, "accounts">>, "acceptance">;
}> = Spec.fromGroups({ ["acceptance"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["accounts"]: acceptance_accounts }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.internal.acceptance;
