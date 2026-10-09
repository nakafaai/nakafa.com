import { GroupSpec, Refs, Spec } from "@confect/core";
import onboarding_mutations from "../../onboarding/mutations.spec";
import onboarding_queries from "../../onboarding/queries.spec";

const spec: Spec.Spec<{
  readonly onboarding: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "onboarding", never, GroupSpec.NamedAt<typeof onboarding_mutations, "mutations"> | GroupSpec.NamedAt<typeof onboarding_queries, "queries">>, "onboarding">;
}> = Spec.make().addAt("onboarding", GroupSpec.makeAt("onboarding").addGroupAt("mutations", onboarding_mutations).addGroupAt("queries", onboarding_queries));

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.onboarding;
