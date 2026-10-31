import { GroupSpec, Refs, Spec } from "@confect/core";
import posts_cleanup from "../../posts/cleanup.spec";

const spec: Spec.Spec<{
  readonly posts: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "posts", never, GroupSpec.NamedAt<typeof posts_cleanup, "cleanup">>, "posts">;
}> = Spec.fromGroups({ ["posts"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["cleanup"]: posts_cleanup }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.internal.posts;
