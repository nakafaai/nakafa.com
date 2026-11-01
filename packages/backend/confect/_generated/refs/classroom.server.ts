import { GroupSpec, Refs, Spec } from "@confect/core";
import classroom_forum_channels from "../../classroom/forum/channels.spec";
import classroom_forum_files from "../../classroom/forum/files.spec";
import classroom_forum_nina from "../../classroom/forum/nina.spec";
import classroom_forum_seed from "../../classroom/forum/seed.spec";
import classroom_library from "../../classroom/library.spec";
import classroom_passages from "../../classroom/passages.spec";
import classroom_seed from "../../classroom/seed.spec";

const spec: Spec.Spec<{
  readonly classroom: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "classroom", never, GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "forum", never, GroupSpec.NamedAt<typeof classroom_forum_channels, "channels"> | GroupSpec.NamedAt<typeof classroom_forum_files, "files"> | GroupSpec.NamedAt<typeof classroom_forum_nina, "nina"> | GroupSpec.NamedAt<typeof classroom_forum_seed, "seed">>, "forum"> | GroupSpec.NamedAt<typeof classroom_library, "library"> | GroupSpec.NamedAt<typeof classroom_passages, "passages"> | GroupSpec.NamedAt<typeof classroom_seed, "seed">>, "classroom">;
}> = Spec.fromGroups({ ["classroom"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["forum"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["channels"]: classroom_forum_channels, ["files"]: classroom_forum_files, ["nina"]: classroom_forum_nina, ["seed"]: classroom_forum_seed }), ["library"]: classroom_library, ["passages"]: classroom_passages, ["seed"]: classroom_seed }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.internal.classroom;
