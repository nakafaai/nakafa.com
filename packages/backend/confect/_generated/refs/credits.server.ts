import { GroupSpec, Refs, Spec } from "@confect/core";
import credits_lots from "../../credits/lots.spec";
import credits_mutations from "../../credits/mutations.spec";

const spec: Spec.Spec<{
  readonly credits: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "credits", never, GroupSpec.NamedAt<typeof credits_lots, "lots"> | GroupSpec.NamedAt<typeof credits_mutations, "mutations">>, "credits">;
}> = Spec.fromGroups({ ["credits"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["lots"]: credits_lots, ["mutations"]: credits_mutations }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.internal.credits;
