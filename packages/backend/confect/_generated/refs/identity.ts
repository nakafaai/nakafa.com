import { GroupSpec, Refs, Spec } from "@confect/core";
import identity_cards from "../../identity/cards.spec";

const spec: Spec.Spec<{
  readonly identity: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "identity", never, GroupSpec.NamedAt<typeof identity_cards, "cards">>, "identity">;
}> = Spec.fromGroups({ ["identity"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["cards"]: identity_cards }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.identity;
