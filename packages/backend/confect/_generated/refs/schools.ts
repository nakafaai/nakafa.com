import { GroupSpec, Refs, Spec } from "@confect/core";
import schools_mutations from "../../schools/mutations.spec";
import schools_queries from "../../schools/queries.spec";

const spec: Spec.Spec<{
  readonly schools: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "schools", never, GroupSpec.NamedAt<typeof schools_mutations, "mutations"> | GroupSpec.NamedAt<typeof schools_queries, "queries">>, "schools">;
}> = Spec.make().addAt("schools", GroupSpec.makeAt("schools").addGroupAt("mutations", schools_mutations).addGroupAt("queries", schools_queries));

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.schools;
