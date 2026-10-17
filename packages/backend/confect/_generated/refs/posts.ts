import { GroupSpec, Refs, Spec } from "@confect/core";
import posts_mutations from "../../posts/mutations.spec";
import posts_queries from "../../posts/queries.spec";

const spec: Spec.Spec<{
  readonly posts: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "posts", never, GroupSpec.NamedAt<typeof posts_mutations, "mutations"> | GroupSpec.NamedAt<typeof posts_queries, "queries">>, "posts">;
}> = Spec.make().addAt("posts", GroupSpec.makeAt("posts").addGroupAt("mutations", posts_mutations).addGroupAt("queries", posts_queries));

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.posts;
