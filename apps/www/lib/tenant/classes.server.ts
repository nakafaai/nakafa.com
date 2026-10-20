import "@tanstack/react-start/server-only";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { ClassAddress } from "@repo/backend/confect/classroom/class";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Schema } from "effect";
import { preloadConfectQuery } from "@/lib/data/preload.server";
import { orUndefined } from "@/lib/tenant/first.server";
import { memberHandler } from "@/lib/tenant/member.server";

/** One class of the school, which its home and its forum resolve. */
export const ClassInput = Schema.Struct({
  classSlug: ClassAddress,
  slug: TenantSlug,
});

/** The first page of a class's forum channels, the forum tab's rows. */
export const ClassForumInput = Schema.Struct({
  classSlug: ClassAddress,
  numItems: Schema.Int.check(Schema.isBetween({ maximum: 100, minimum: 1 })),
  slug: TenantSlug,
});

/** The school whose classes the sidebar lists. */
export const ShellInput = Schema.Struct({ slug: TenantSlug });

/** The class of a home or a forum page, as the class resolves for the viewer. */
export const classHandler = memberHandler(
  ({ classSlug, slug }: typeof ClassInput.Type, token: string) =>
    Effect.gen(function* () {
      const resolved = yield* orUndefined(
        preloadConfectQuery(
          classroom.classes.resolve,
          { classSlug, slug },
          token
        )
      );
      return { resolved, channels: undefined };
    })
);

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
