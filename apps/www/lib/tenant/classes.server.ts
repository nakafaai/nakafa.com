import "@tanstack/react-start/server-only";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { ClassAddress } from "@repo/backend/confect/classroom/class";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Schema } from "effect";
import { readOptional, readRequired } from "@/lib/data/read.server";
import { memberHandler } from "@/lib/tenant/member.server";

/** The first page of a class's forum channels, the forum tab's rows. */
export const ClassForumInput = Schema.Struct({
  classSlug: ClassAddress,
  numItems: Schema.Int.check(Schema.isBetween({ maximum: 100, minimum: 1 })),
  slug: TenantSlug,
});

/** The school whose classes the sidebar lists. */
export const ShellInput = Schema.Struct({ slug: TenantSlug });

/**
 * The class and the first page of its forum channels, in order: the channels
 * belong to the class. A class that the viewer may not open, or that is ambiguous,
 * ends the page as not found.
 */
export const classForumHandler = memberHandler(
  ({ classSlug, numItems, slug }: typeof ClassForumInput.Type, token: string) =>
    Effect.gen(function* () {
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
    })
);

/** The classes the viewer may open in the school's active periods, which the sidebar lists. */
export const shellClassesHandler = memberHandler(
  ({ slug }: typeof ShellInput.Type, token: string) =>
    readOptional(classroom.classes.mine, { slug }, token)
);
