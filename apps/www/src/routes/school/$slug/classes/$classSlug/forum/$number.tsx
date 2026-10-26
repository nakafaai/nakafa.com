import { Id } from "@repo/backend/confect/_generated/id";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option, Schema } from "effect";
import type { ReactElement } from "react";
import { CHANNEL_PAGE_SIZE } from "@/components/tenant/classes/channels";
import { ClassShell } from "@/components/tenant/classes/shell";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { readClassDiscussionFn } from "@/lib/tenant/classes.functions";
import { readClassAddress, readDiscussionNumber } from "@/lib/tenant/params";

/** The reply of the discussion to bring into view, such as the one a mention points to. */
const DiscussionSearch = Schema.Struct({
  message: Schema.optional(Id("classroomMessages")),
});

/**
 * One numbered discussion of a class's forum, such as `/classes/fisika-x-1/forum/12` (ADR 0026):
 * beside its channel on a wide screen, and on its own on a phone. An address that names no class
 * or no discussion of it is not found for every viewer.
 */
export const Route = createFileRoute(
  "/school/$slug/classes/$classSlug/forum/$number"
)({
  validateSearch: Schema.toStandardSchemaV1(DiscussionSearch),
  beforeLoad: ({ params }) => {
    const classAddress = readClassAddress(params.classSlug);
    const number = readDiscussionNumber(params.number);
    if (Option.isNone(classAddress) || Option.isNone(number)) {
      throw notFound();
    }
    return { classAddress: classAddress.value, discussion: number.value };
  },
  loader: ({ context }) => {
    if (context.school._tag !== "Member") {
      return;
    }
    return readClassDiscussionFn({
      data: {
        classSlug: context.classAddress,
        number: context.discussion,
        numItems: CHANNEL_PAGE_SIZE,
        slug: context.slug,
      },
    });
  },
  component: SchoolClassDiscussionPage,
  notFoundComponent: SchoolPageNotFound,
});

function SchoolClassDiscussionPage(): ReactElement {
  const { classAddress, discussion, slug } = Route.useRouteContext();
  const preload = Route.useLoaderData();
  const { message } = Route.useSearch();
  return (
    <ClassShell
      classSlug={classAddress}
      preload={preload}
      slug={slug}
      view={{
        _tag: "discussion",
        jump: Option.fromUndefinedOr(message),
        number: discussion,
      }}
    />
  );
}
