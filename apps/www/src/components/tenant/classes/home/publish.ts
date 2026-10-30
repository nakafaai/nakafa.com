import type { Ref } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import type classroom from "@repo/backend/confect/_generated/refs/classroom";
import { Clock, Effect, type Result, Schema } from "effect";
import { forumCall } from "@/components/tenant/classes/forum/call";
import {
  type ClassPost,
  publishUpdate,
} from "@/components/tenant/classes/home/optimistic";

/** The arguments of one announcement, as the dialog gives them. */
type PublishArgs = Ref.Args<typeof classroom.posts.publish>;

/**
 * The announcement the teacher posts, shown at once first on the class home under its client key,
 * which is its placeholder ID until the server answers. `publish` is Confect's mutation with the
 * optimistic update it is given.
 */
export const publishPost = Effect.fn("classroom.posts.publish")(function* <E>(
  publish: (
    update: ReturnType<typeof publishUpdate>,
    args: PublishArgs
  ) => Promise<Result.Result<ClassPost, E>>,
  author: ClassPost["author"],
  args: PublishArgs
) {
  const createdAt = yield* Clock.currentTimeMillis;
  const id = yield* Schema.decodeUnknownEffect(Id("classroomPosts"))(
    args.clientKey
  );
  return yield* forumCall(() =>
    publish(
      publishUpdate({
        author,
        clientKey: args.clientKey,
        createdAt,
        editedAt: null,
        email: args.email,
        id,
        mine: true,
        text: args.text,
      }),
      args
    )
  );
});
