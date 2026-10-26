import { Id } from "@repo/backend/confect/_generated/id";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Match, Option, Schema } from "effect";
import type { BreadcrumbHeaderItem } from "@/components/shared/breadcrumb/header";
import type { ClassView } from "@/components/tenant/classes/view";
import {
  schoolClassChannelTarget,
  schoolClassForumTarget,
  schoolClassTarget,
} from "@/lib/routing/school/target";

/** The class a path starts from, the school it belongs to, and the forum's label. */
const PathRoot = Schema.Struct({
  classSlug: Schema.String,
  forum: Schema.String,
  name: Schema.String,
  slug: TenantSlug,
});

/** The channel a path passes through, by its ID and the name it shows. */
const PathChannel = Schema.Struct({
  id: Id("classroomChannels"),
  label: Schema.String,
});

/**
 * The path of a class page after the school's home, the page itself last: the class alone on its
 * home; the class and the forum on the channel list; the forum and the channel on a channel; and the
 * channel and the discussion's number and title on a discussion. A channel whose name is not known
 * yet is left out, so the path never shows a placeholder.
 */
export const classPath = (
  view: typeof ClassView.Type,
  root: typeof PathRoot.Type,
  channel: Option.Option<typeof PathChannel.Type>,
  discussion: Option.Option<string>
): readonly BreadcrumbHeaderItem[] => {
  const klass = {
    label: root.name,
    target: schoolClassTarget(root.slug, root.classSlug),
  };
  const forum = {
    label: root.forum,
    target: schoolClassForumTarget(root.slug, root.classSlug),
  };
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
      ...Option.match(discussion, {
        onNone: () => [],
        onSome: (label) => [{ label }],
      }),
    ],
  });
};
