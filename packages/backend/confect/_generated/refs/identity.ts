import { GroupSpec, Refs, Spec } from "@confect/core";
import identity_cards from "../../identity/cards.spec";

const spec: Spec.Spec<{
  readonly identity: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "identity", never, GroupSpec.NamedAt<typeof identity_cards, "cards">>, "identity">;
}> = Spec.make().addAt("identity", GroupSpec.makeAt("identity").addGroupAt("cards", identity_cards));

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.identity;
