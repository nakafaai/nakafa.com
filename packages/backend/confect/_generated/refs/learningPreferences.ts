import { GroupSpec, Refs, Spec } from "@confect/core";
import learningPreferences_mutations from "../../learningPreferences/mutations.spec";
import learningPreferences_queries from "../../learningPreferences/queries.spec";

const spec: Spec.Spec<{
  readonly learningPreferences: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "learningPreferences", never, GroupSpec.NamedAt<typeof learningPreferences_mutations, "mutations"> | GroupSpec.NamedAt<typeof learningPreferences_queries, "queries">>, "learningPreferences">;
}> = Spec.fromGroups({ ["learningPreferences"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["mutations"]: learningPreferences_mutations, ["queries"]: learningPreferences_queries }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.learningPreferences;
