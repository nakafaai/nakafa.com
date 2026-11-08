import { Id } from "@repo/backend/confect/_generated/id";
import { createFileRoute, useMatch } from "@tanstack/react-router";
import { Option, Schema } from "effect";
import { type ReactElement, useState } from "react";
import {
  createOpening,
  OpeningContext,
} from "@/components/tenant/classes/forum/open";
import { ClassShell } from "@/components/tenant/classes/shell";
import type { ClassView } from "@/components/tenant/classes/view";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { guardSchoolPage } from "@/lib/tenant/guard";
import { readClassAddress, readDiscussionNumber } from "@/lib/tenant/params";

/**
 * The channel the forum shows, by its ID, and the message to bring into view in it or in the discussion the address
 * names. Without a channel or a discussion the forum lists the class's channels. The numbered discussions of ADR 0026
 * keep the path below the forum, so a channel is a search value.
 */
const ForumSearch = Schema.Struct({
  channel: Schema.optional(Id("classroomChannels")),
  message: Schema.optional(Id("classroomMessages")),
});

/**
 * The forum of one class of the school: its channels, the messages of the channel the address names, or one numbered
 * discussion beside its channel, such as `/classes/fisika-x-1/forum/12` (ADR 0026). The class page is this route's
 * alone, so opening, switching and closing a discussion keep the page, its channel and its scroll mounted, and only
 * the pane beside it changes. The School guard answers not found for an address that names no class, and the page for
 * a discussion's address whose digits name none, since its child routes draw nothing of their own.
 */
export const Route = createFileRoute("/school/$slug/classes/$classSlug/forum")({
  validateSearch: Schema.toStandardSchemaV1(ForumSearch),
  ...guardSchoolPage({
    reads: (params: { readonly classSlug: string }) =>
      Option.all({ classAddress: readClassAddress(params.classSlug) }),
  }),
  component: SchoolClassForumPage,
});

/** What the forum's address names: one discussion, else one channel, else the list of channels. */
function forumView(
  number: Option.Option<number>,
  channel: Option.Option<Id<"classroomChannels">>,
  jump: Option.Option<Id<"classroomMessages">>
): typeof ClassView.Type {
  if (Option.isSome(number)) {
    return { _tag: "discussion", jump, number: number.value };
  }
  if (Option.isSome(channel)) {
    return { _tag: "channel", channelId: channel.value, jump };
  }
  return { _tag: "forum" };
}

function SchoolClassForumPage(): ReactElement {
  const { classAddress, slug } = Route.useRouteContext();
  const { channel, message } = Route.useSearch();
  // The thread a press opened, kept for as long as the reader stays in the forum.
  const [opening] = useState(createOpening);
  const jump = Option.fromUndefinedOr(message);
  // The discussion's digits, while the address names one.
  const digits = useMatch({
    from: "/school/$slug/classes/$classSlug/forum/$number",
    select: (match) => match.params.number,
    shouldThrow: false,
  });

  const number = Option.flatMap(
    Option.fromUndefinedOr(digits),
    readDiscussionNumber
  );

  if (digits !== undefined && Option.isNone(number)) {
    return <SchoolPageNotFound />;
  }
  return (
    <OpeningContext value={opening}>
      <ClassShell
        classSlug={classAddress}
        slug={slug}
        view={forumView(number, Option.fromUndefinedOr(channel), jump)}
      />
    </OpeningContext>
  );
}
