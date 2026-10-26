import type { Ref } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import type classroom from "@repo/backend/confect/_generated/refs/classroom";
import { Clock, Effect, type Result, Schema } from "effect";
import { forumCall } from "@/components/tenant/classes/forum/call";
import {
  type ForumMessage,
  openUpdate,
  replyUpdate,
  sendUpdate,
} from "@/components/tenant/classes/forum/optimistic";

/** The arguments of one send, as the composer gives them. */
type SendArgs = Ref.Args<typeof classroom.forum.messages.send>;

/** The arguments of one reply in a discussion, as the composer gives them. */
type ReplyArgs = Ref.Args<typeof classroom.forum.threads.reply>;

/** The arguments of one discussion that the viewer opens. */
type OpenArgs = Ref.Args<typeof classroom.forum.threads.open>;

/** One mutation with the optimistic update it is given, as Confect calls it. */
type Optimistic<U, Args, A, E> = (
  update: U,
  args: Args
) => Promise<Result.Result<A, E>>;

/**
 * The message the viewer writes now, as the forum shows it before the server answers: its client
 * key is its placeholder ID, and it carries the discussion it opens, if any.
 */
const draft = Effect.fn("classroom.forum.draft")(function* (
  author: ForumMessage["author"],
  clientKey: string,
  text: string,
  discussion: ForumMessage["discussion"]
) {
  const createdAt = yield* Clock.currentTimeMillis;
  const id = yield* Schema.decodeUnknownEffect(Id("classroomMessages"))(
    clientKey
  );
  return {
    author,
    clientKey,
    createdAt,
    discussion,
    editedAt: null,
    id,
    mine: true,
    text,
  };
});

/** The send of one message to a channel by the viewer, shown at once at the bottom of the channel. */
export const sendMessage = Effect.fn("classroom.forum.send")(function* <E>(
  send: Optimistic<ReturnType<typeof sendUpdate>, SendArgs, ForumMessage, E>,
  author: ForumMessage["author"],
  args: SendArgs
) {
  const message = yield* draft(author, args.clientKey, args.text, null);
  return yield* forumCall(() => send(sendUpdate(message), args));
});

/** The reply of the viewer in a discussion, shown at once at the bottom of the discussion. */
export const sendReply = Effect.fn("classroom.forum.reply")(function* <E>(
  reply: Optimistic<ReturnType<typeof replyUpdate>, ReplyArgs, ForumMessage, E>,
  author: ForumMessage["author"],
  args: ReplyArgs
) {
  const message = yield* draft(author, args.clientKey, args.text, null);
  return yield* forumCall(() => reply(replyUpdate(message), args));
});

/**
 * The discussion the viewer opens, shown at once at the bottom of its channel as its opening
 * message. Its number comes from the server, so the message shows the title alone until then.
 */
export const openDiscussion = Effect.fn("classroom.forum.open")(function* <
  A,
  E,
>(
  open: Optimistic<ReturnType<typeof openUpdate>, OpenArgs, A, E>,
  author: ForumMessage["author"],
  args: OpenArgs
) {
  const message = yield* draft(author, args.clientKey, args.text, {
    lastReplyAt: null,
    number: 1,
    replies: 0,
    title: args.title,
    unread: false,
  });
  return yield* forumCall(() => open(openUpdate(message), args));
});
