import { GroupSpec, Refs, Spec } from "@confect/core";
import classroom_classes from "../../classroom/classes.spec";
import classroom_forum_channels from "../../classroom/forum/channels.spec";
import classroom_forum_messages from "../../classroom/forum/messages.spec";
import classroom_forum_people from "../../classroom/forum/people.spec";
import classroom_forum_reads from "../../classroom/forum/reads.spec";
import classroom_forum_threads from "../../classroom/forum/threads.spec";
import classroom_posts from "../../classroom/posts.spec";
import classroom_tasks from "../../classroom/tasks.spec";
import classroom_teachers from "../../classroom/teachers.spec";

const spec: Spec.Spec<{
  readonly classroom: GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "classroom", never, GroupSpec.NamedAt<typeof classroom_classes, "classes"> | GroupSpec.NamedAt<GroupSpec.GroupSpec<"Convex", "forum", never, GroupSpec.NamedAt<typeof classroom_forum_channels, "channels"> | GroupSpec.NamedAt<typeof classroom_forum_messages, "messages"> | GroupSpec.NamedAt<typeof classroom_forum_people, "people"> | GroupSpec.NamedAt<typeof classroom_forum_reads, "reads"> | GroupSpec.NamedAt<typeof classroom_forum_threads, "threads">>, "forum"> | GroupSpec.NamedAt<typeof classroom_posts, "posts"> | GroupSpec.NamedAt<typeof classroom_tasks, "tasks"> | GroupSpec.NamedAt<typeof classroom_teachers, "teachers">>, "classroom">;
}> = Spec.fromGroups({ ["classroom"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["classes"]: classroom_classes, ["forum"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["channels"]: classroom_forum_channels, ["messages"]: classroom_forum_messages, ["people"]: classroom_forum_people, ["reads"]: classroom_forum_reads, ["threads"]: classroom_forum_threads }), ["posts"]: classroom_posts, ["tasks"]: classroom_tasks, ["teachers"]: classroom_teachers }) }) as typeof spec;

const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);

export default refs.public.classroom;
