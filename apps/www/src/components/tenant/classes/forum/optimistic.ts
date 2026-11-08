import type { Ref } from "@confect/core";
import type {
  OptimisticLocalStore as LocalStore,
  OptimisticUpdate,
} from "@confect/react";
import type { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { ReadPlace } from "@repo/backend/confect/classroom/forum/read";
import { Number as Num, Option, Schema } from "effect";
import {
  changeLoaded,
  changeRows,
  dropRows,
  withPage,
} from "@/lib/data/loaded";

/** One message of a channel, as the forum shows it. */
export type ForumMessage = Ref.Returns<
  typeof classroom.forum.messages.page
>["page"][number];

const { page } = classroom.forum.messages;
const { get, replies } = classroom.forum.threads;
const threadList = classroom.forum.threads.list;
const channels = classroom.forum.channels;
const reads = classroom.forum.reads;

/** Two read places name the same channel or the same discussion. */
const samePlace = Schema.toEquivalence(ReadPlace);

/**
 * Replaces one message, in every page of its channel's messages that the store holds, with what
 * `change` makes of it. A page without the message stays as it is.
 */
const changeMessage = (
  localStore: LocalStore.OptimisticLocalStore,
  messageId: Id<"classroomMessages">,
  change: (message: ForumMessage) => ForumMessage
) => {
  changeLoaded(localStore, page, (value) =>
    changeRows(value, (message) => message.id === messageId, change)
  );
};

/**
 * Puts a message first in the newest page of its channel, before the server holds it. The page
 * shows newest first, so the message lands at the bottom of the channel.
 */
const prependToChannel = (
  localStore: LocalStore.OptimisticLocalStore,
  channelId: Id<"classroomChannels">,
  message: ForumMessage
) => {
  changeLoaded(localStore, page, (value, args) =>
    args.channelId === channelId && args.paginationOpts.cursor === null
      ? Option.some(withPage(value, (rows) => [message, ...rows]))
      : Option.none()
  );
};

/**
 * Changes the summary of one discussion wherever the store holds it: in its own page and on the
 * message that opens it in its channel.
 */
export const changeDiscussion = (
  localStore: LocalStore.OptimisticLocalStore,
  number: number,
  change: (discussion: Discussion) => Discussion
) => {
  changeLoaded(localStore, get, (value, args) =>
    args.number === number
      ? Option.some({ ...value, discussion: change(value.discussion) })
      : Option.none()
  );
  changeLoaded(localStore, page, (value) =>
    changeRows(
      value,
      (message) => message.discussion?.number === number,
      (message) => ({
        ...message,
        discussion: Option.getOrNull(
          Option.map(Option.fromNullOr(message.discussion), change)
        ),
      })
    )
  );
};

/** The summary of one discussion, as a channel and the discussion's page show it. */
type Discussion = NonNullable<ForumMessage["discussion"]>;

/** Shows a message the member sends in a channel at once, at the bottom of the channel. */
export const sendUpdate =
  (
    message: ForumMessage
  ): OptimisticUpdate<typeof classroom.forum.messages.send> =>
  (localStore, args) => {
    prependToChannel(localStore, args.channelId, message);
  };

/** Shows the message that opens a discussion at once, at the bottom of its channel. */
export const openUpdate =
  (
    message: ForumMessage
  ): OptimisticUpdate<typeof classroom.forum.threads.open> =>
  (localStore, args) => {
    prependToChannel(localStore, args.channelId, message);
  };

/**
 * Shows a reply at once at the bottom of its discussion, and counts it in the discussion's
 * summary, read by its sender.
 */
export const replyUpdate =
  (
    message: ForumMessage
  ): OptimisticUpdate<typeof classroom.forum.threads.reply> =>
  (localStore, args) => {
    changeLoaded(localStore, replies, (value, loaded) =>
      loaded.number === args.number && loaded.paginationOpts.cursor === null
        ? Option.some(withPage(value, (rows) => [message, ...rows]))
        : Option.none()
    );
    changeDiscussion(localStore, args.number, (discussion) => ({
      ...discussion,
      lastReplyAt: message.createdAt,
      replies: discussion.replies + 1,
      unread: false,
    }));
  };

/**
 * Moves the viewer's read mark of a place at once, and clears the unread mark of the channel or
 * the discussion it names. A mark never moves back.
 */
export const markUpdate: OptimisticUpdate<typeof classroom.forum.reads.mark> = (
  localStore,
  args
) => {
  changeLoaded(localStore, reads.get, ({ at }, loaded) =>
    loaded.classId === args.classId && samePlace(loaded.place, args.place)
      ? Option.some({ at: at === null ? args.at : Num.max(at, args.at) })
      : Option.none()
  );
  const place = args.place;
  if (place._tag === "discussion") {
    changeDiscussion(localStore, place.number, (discussion) => ({
      ...discussion,
      unread:
        discussion.lastReplyAt !== null && discussion.lastReplyAt > args.at,
    }));
    return;
  }
  changeLoaded(localStore, channels.list, (value) =>
    changeRows(
      value,
      (channel) => channel.id === place.channelId,
      (channel) => ({ ...channel, unread: false })
    )
  );
};

/** Shows the author's new text of a message at once, edited at `at`. */
export const editUpdate =
  (at: number): OptimisticUpdate<typeof classroom.forum.messages.edit> =>
  (localStore, args) => {
    changeMessage(localStore, args.messageId, (message) => ({
      ...message,
      editedAt: at,
      text: args.text,
    }));
  };

/** Shows a message a teacher hides without its text at once, in its place. */
export const hideUpdate: OptimisticUpdate<
  typeof classroom.forum.messages.hide
> = (localStore, args) => {
  changeMessage(localStore, args.messageId, (message) => ({
    ...message,
    attachments: [],
    poll: null,
    text: null,
  }));
};

/** Takes the discussion at `number` out of every list of the class's discussions that holds it. */
const leaveThreads = (
  localStore: LocalStore.OptimisticLocalStore,
  classId: Id<"classes">,
  number: number
) => {
  changeLoaded(localStore, threadList, (value, args) =>
    args.classId === classId
      ? dropRows(value, (row) => row.discussion.number === number)
      : Option.none()
  );
};

/** Takes an archived discussion out of the class's list at once; a refusal brings it back. */
export const archiveThreadUpdate: OptimisticUpdate<
  typeof classroom.forum.threads.archive
> = (localStore, args) => leaveThreads(localStore, args.classId, args.number);

/** Takes a restored discussion out of the archived list at once; a refusal brings it back. */
export const restoreThreadUpdate: OptimisticUpdate<
  typeof classroom.forum.threads.restore
> = (localStore, args) => leaveThreads(localStore, args.classId, args.number);
