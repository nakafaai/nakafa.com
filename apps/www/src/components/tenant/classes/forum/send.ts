import type { Ref } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import type classroom from "@repo/backend/confect/_generated/refs/classroom";
import { Clock, Effect, type Result, Schema } from "effect";
import { forumCall } from "@/components/tenant/classes/forum/call";
import {
  type ForumMessage,
  sendUpdate,
} from "@/components/tenant/classes/forum/optimistic";

/** The arguments of one send, as the composer gives them. */
type SendArgs = Ref.Args<typeof classroom.forum.messages.send>;

/**
 * The send of one message by the viewer. The message is shown at once under its client key, which
 * is also its placeholder ID until the server answers, written now by the viewer. `send` is
 * Confect's mutation with the optimistic update it is given.
 */
export const sendMessage = Effect.fn("classroom.forum.send")(function* <E>(
  send: (
    update: ReturnType<typeof sendUpdate>,
    args: SendArgs
  ) => Promise<Result.Result<ForumMessage, E>>,
  author: ForumMessage["author"],
  args: SendArgs
) {
  const createdAt = yield* Clock.currentTimeMillis;
  const id = yield* Schema.decodeUnknownEffect(Id("classroomMessages"))(
    args.clientKey
  );
  return yield* forumCall(() =>
    send(
      sendUpdate({
        author,
        clientKey: args.clientKey,
        createdAt,
        editedAt: null,
        id,
        mine: true,
        text: args.text,
      }),
      args
    )
  );
});
