import { GroupSpec, Refs, Spec } from "@confect/core";
import island_mutations from "../../island/mutations.spec";
import island_queries from "../../island/queries.spec";

const spec: Spec.Spec<{
  readonly island: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "island", never, GroupSpec.NamedAt<typeof island_mutations, "mutations"> | GroupSpec.NamedAt<typeof island_queries, "queries">>, "island">;
}> = Spec.fromGroups({ ["island"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["mutations"]: island_mutations, ["queries"]: island_queries }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.island;
