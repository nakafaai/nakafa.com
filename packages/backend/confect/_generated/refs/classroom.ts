import { GroupSpec, Refs, Spec } from "@confect/core";
import classroom_classes from "../../classroom/classes.spec";
import classroom_forum_channels from "../../classroom/forum/channels.spec";
import classroom_forum_messages from "../../classroom/forum/messages.spec";
import classroom_teachers from "../../classroom/teachers.spec";

const spec: Spec.Spec<{
  readonly classroom: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "classroom", never, GroupSpec.NamedAt<typeof classroom_classes, "classes"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "forum", never, GroupSpec.NamedAt<typeof classroom_forum_channels, "channels"> | GroupSpec.NamedAt<typeof classroom_forum_messages, "messages">>, "forum"> | GroupSpec.NamedAt<typeof classroom_teachers, "teachers">>, "classroom">;
}> = Spec.fromGroups({ ["classroom"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["classes"]: classroom_classes, ["forum"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["channels"]: classroom_forum_channels, ["messages"]: classroom_forum_messages }), ["teachers"]: classroom_teachers }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.classroom;
