import { GroupSpec, Refs, Spec } from "@confect/core";
import identity_cards from "../../identity/cards.spec";
import identity_logins from "../../identity/logins.spec";

const spec: Spec.Spec<{
  readonly identity: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "identity", never, GroupSpec.NamedAt<typeof identity_cards, "cards"> | GroupSpec.NamedAt<typeof identity_logins, "logins">>, "identity">;
}> = Spec.fromGroups({ ["identity"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["cards"]: identity_cards, ["logins"]: identity_logins }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.identity;
