import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { Effect } from "effect";
import { readOptional, readRequired } from "@/lib/data/read.server";
import type {
  ClassDiscussionInput,
  ClassForumInput,
  ShellInput,
} from "@/lib/tenant/classes";
import { memberHandler } from "@/lib/tenant/member.server";

/**
 * The class and the first page of its forum channels, in order: the channels
 * belong to the class. A class that the viewer may not open, or that is ambiguous,
 * ends the page as not found.
 */
const readClassForum = Effect.fn("www.tenant.classForum")(function* (
  { classSlug, numItems, slug }: typeof ClassForumInput.Type,
  token: string
) {
  const resolved = yield* readRequired(
    classroom.classes.resolve,
    { classSlug, slug },
    token
  );
  const channels = yield* readRequired(
    classroom.forum.channels.list,
    {
      classId: resolved.id,
      paginationOpts: { cursor: null, numItems },
      slug,
    },
    token
  );
  return {
    resolved,
    channels: { isDone: channels.isDone, page: channels.page },
  };
});

/** The class of a forum page and the first page of its channels, which the forum's loader reads. */
export const classForumHandler = memberHandler(readClassForum);

/**
 * The class, the first page of its forum channels, and one of its discussions by
 * its number. A discussion the class does not hold ends the page as not found.
 */
export const classDiscussionHandler = memberHandler(
  ({ number, ...forum }: typeof ClassDiscussionInput.Type, token: string) =>
    Effect.gen(function* () {
      const read = yield* readClassForum(forum, token);
      const thread = yield* readRequired(
        classroom.forum.threads.get,
        { classId: read.resolved.id, number, slug: forum.slug },
        token
      );
      return { ...read, thread };
    })
);

/** The classes the viewer may open in the school's active periods, which the sidebar lists. */
export const shellClassesHandler = memberHandler(
  ({ slug }: typeof ShellInput.Type, token: string) =>
    readOptional(classroom.classes.mine, { slug }, token)
);
