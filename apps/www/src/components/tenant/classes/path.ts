import { Id } from "@repo/backend/confect/_generated/id";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Match, Option, Schema } from "effect";
import type { BreadcrumbHeaderItem } from "@/components/shared/breadcrumb/header";
import type { ClassView } from "@/components/tenant/classes/view";
import {
  schoolClassChannelTarget,
  schoolClassForumTarget,
  schoolClassTarget,
  schoolClassTasksTarget,
} from "@/lib/routing/school/target";

/** The class a path starts from, the school it belongs to, and the labels of the forum, the library, and the tasks. */
const PathRoot = Schema.Struct({
  classSlug: Schema.String,
  forum: Schema.String,
  library: Schema.String,
  name: Schema.String,
  slug: TenantSlug,
  tasks: Schema.String,
});

/** The channel a path passes through, by its ID and the name it shows. */
const PathChannel = Schema.Struct({
  id: Id("classroomChannels"),
  label: Schema.String,
});

/**
 * The path of a class page after the school's home, the page itself last: the class alone on its
 * home; the class and the forum on the channel list; the forum and the channel on a channel; the
 * channel and the discussion's number and title on a discussion; the class and the tasks on the task
 * list; the class and the library on the library; and the tasks and the task's title on a task. A name that is not known yet is left out, so
 * the path never shows a placeholder. `leaf` is the last name: the discussion's or the task's.
 */
export const classPath = (
  view: typeof ClassView.Type,
  root: typeof PathRoot.Type,
  channel: Option.Option<typeof PathChannel.Type>,
  leaf: Option.Option<string>
): readonly BreadcrumbHeaderItem[] => {
  const klass = {
    label: root.name,
    target: schoolClassTarget(root.slug, root.classSlug),
  };
  const forum = {
    label: root.forum,
    target: schoolClassForumTarget(root.slug, root.classSlug),
  };
  const last = Option.match(leaf, {
    onNone: () => [],
    onSome: (label) => [{ label }],
  });
  return Match.valueTags(view, {
    home: () => [{ label: root.name }],
    forum: () => [klass, { label: root.forum }],
    channel: () =>
      Option.match(channel, {
        onNone: () => [klass, { label: root.forum }],
        onSome: (found) => [klass, forum, { label: found.label }],
      }),
    discussion: () => [
      klass,
      forum,
      ...Option.match(channel, {
        onNone: () => [],
        onSome: (found) => [
          {
            label: found.label,
            target: schoolClassChannelTarget(
              root.slug,
              root.classSlug,
              found.id
            ),
          },
        ],
      }),
      ...last,
    ],
    library: () => [klass, { label: root.library }],
    tasks: () => [klass, { label: root.tasks }],
    task: () => [
      klass,
      {
        label: root.tasks,
        target: schoolClassTasksTarget(root.slug, root.classSlug),
      },
      ...last,
    ],
  });
};
