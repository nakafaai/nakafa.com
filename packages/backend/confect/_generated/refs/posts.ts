import { GroupSpec, Refs, Spec } from "@confect/core";
import posts_mutations from "../../posts/mutations.spec";
import posts_queries from "../../posts/queries.spec";

const spec: Spec.Spec<{
  readonly posts: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "posts", never, GroupSpec.NamedAt<typeof posts_mutations, "mutations"> | GroupSpec.NamedAt<typeof posts_queries, "queries">>, "posts">;
}> = Spec.fromGroups({ ["posts"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["mutations"]: posts_mutations, ["queries"]: posts_queries }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.posts;
