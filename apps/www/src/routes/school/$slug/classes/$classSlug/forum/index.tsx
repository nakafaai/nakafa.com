import { Id } from "@repo/backend/confect/_generated/id";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option, Schema } from "effect";
import type { ReactElement } from "react";
import { ClassShell } from "@/components/tenant/classes/shell";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { readClassAddress } from "@/lib/tenant/params";

/**
 * The channel the forum shows, by its ID, and the message of it to bring into view. Without a
 * channel the forum lists the class's channels. The numbered discussions of ADR 0026 keep the path
 * below the forum, so a channel is a search value.
 */
const ForumSearch = Schema.Struct({
  channel: Schema.optional(Id("classroomChannels")),
  message: Schema.optional(Id("classroomMessages")),
});

/**
 * The forum of one class of the school: its channels, or the messages of the channel the address
 * names. A failed address to a class is not found for every viewer.
 */
export const Route = createFileRoute("/school/$slug/classes/$classSlug/forum/")(
  {
    validateSearch: Schema.toStandardSchemaV1(ForumSearch),
    beforeLoad: ({ params }) => {
      const classAddress = readClassAddress(params.classSlug);
      if (Option.isNone(classAddress)) {
        throw notFound();
      }
      return { classAddress: classAddress.value };
    },
    component: SchoolClassForumPage,
    notFoundComponent: SchoolPageNotFound,
  }
);

function SchoolClassForumPage(): ReactElement {
  const { classAddress, slug } = Route.useRouteContext();
  const { channel, message } = Route.useSearch();
  return (
    <ClassShell
      classSlug={classAddress}
      slug={slug}
      view={
        channel === undefined
          ? { _tag: "forum" }
          : {
              _tag: "channel",
              channelId: channel,
              jump: Option.fromUndefinedOr(message),
            }
      }
    />
  );
}
