import "@tanstack/react-start/server-only";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { Effect } from "effect";
import { preloadConfectQuery } from "@/lib/data/preload.server";
import type { ClassForumInput, ShellInput } from "@/lib/tenant/classes";
import { orUndefined } from "@/lib/tenant/first.server";
import { memberHandler } from "@/lib/tenant/member.server";

/** The class and the first page of its forum channels, in order: the channels belong to the class. */
export const classForumHandler = memberHandler(
  ({ classSlug, numItems, slug }: typeof ClassForumInput.Type, token: string) =>
    Effect.gen(function* () {
      const resolved = yield* orUndefined(
        preloadConfectQuery(
          classroom.classes.resolve,
          { classSlug, slug },
          token
        )
      );
      if (resolved === undefined) {
        return { resolved, channels: undefined };
      }
      const channels = yield* orUndefined(
        preloadConfectQuery(
          classroom.forum.channels.list,
          {
            classId: resolved.id,
            paginationOpts: { cursor: null, numItems },
            slug,
          },
          token
        )
      );
      return {
        resolved,
        channels:
          channels === undefined
            ? undefined
            : { isDone: channels.isDone, page: channels.page },
      };
    })
);

/** The classes the viewer may open in the school's active periods, which the sidebar lists. */
export const shellClassesHandler = memberHandler(
  ({ slug }: typeof ShellInput.Type, token: string) =>
    orUndefined(preloadConfectQuery(classroom.classes.mine, { slug }, token))
);
