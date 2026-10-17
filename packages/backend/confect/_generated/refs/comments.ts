import { GroupSpec, Refs, Spec } from "@confect/core";
import comments_mutations from "../../comments/mutations.spec";
import comments_queries from "../../comments/queries.spec";

const spec: Spec.Spec<{
  readonly comments: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "comments", never, GroupSpec.NamedAt<typeof comments_mutations, "mutations"> | GroupSpec.NamedAt<typeof comments_queries, "queries">>, "comments">;
}> = Spec.fromGroups({ ["comments"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["mutations"]: comments_mutations, ["queries"]: comments_queries }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.comments;
