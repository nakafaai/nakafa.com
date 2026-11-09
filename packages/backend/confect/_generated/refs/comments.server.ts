import { GroupSpec, Refs, Spec } from "@confect/core";
import comments_files from "../../comments/files.spec";

const spec: Spec.Spec<{
  readonly comments: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "comments", never, GroupSpec.NamedAt<typeof comments_files, "files">>, "comments">;
}> = Spec.fromGroups({ ["comments"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["files"]: comments_files }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.internal.comments;
