import type { Ref } from "@confect/core";
import type {
  OptimisticLocalStore as LocalStore,
  OptimisticUpdate,
} from "@confect/react";
import type { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { ReadPlace } from "@repo/backend/confect/classroom/forum/read";
import { Array as Arr, Number as Num, Option, Schema } from "effect";

/** One message of a channel, as the forum shows it. */
export type ForumMessage = Ref.Returns<
  typeof classroom.forum.messages.page
>["page"][number];

const { page } = classroom.forum.messages;
const { get, replies } = classroom.forum.threads;
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
  for (const query of localStore.getAllQueries(page)) {
    if (
      Option.isSome(query.value) &&
      Arr.some(query.value.value.page, (message) => message.id === messageId)
    ) {
      localStore.setQuery(
        page,
        query.args,
        Option.some({
          ...query.value.value,
          page: Arr.map(query.value.value.page, (message) =>
            message.id === messageId ? change(message) : message
          ),
        })
      );
    }
  }
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
  for (const query of localStore.getAllQueries(page)) {
    if (
      Option.isSome(query.value) &&
      query.args.channelId === channelId &&
      query.args.paginationOpts.cursor === null
    ) {
      localStore.setQuery(
        page,
        query.args,
        Option.some({
          ...query.value.value,
          page: [message, ...query.value.value.page],
        })
      );
    }
  }
};

/**
 * Changes the summary of one discussion wherever the store holds it: in its own page and on the
 * message that opens it in its channel.
 */
const changeDiscussion = (
  localStore: LocalStore.OptimisticLocalStore,
  number: number,
  change: (discussion: Discussion) => Discussion
) => {
  for (const query of localStore.getAllQueries(get)) {
    if (Option.isSome(query.value) && query.args.number === number) {
      localStore.setQuery(
        get,
        query.args,
        Option.some({
          ...query.value.value,
          discussion: change(query.value.value.discussion),
        })
      );
    }
  }
  for (const query of localStore.getAllQueries(page)) {
    if (
      Option.isSome(query.value) &&
      Arr.some(
        query.value.value.page,
        (message) => message.discussion?.number === number
      )
    ) {
      localStore.setQuery(
        page,
        query.args,
        Option.some({
          ...query.value.value,
          page: Arr.map(query.value.value.page, (message) =>
            message.discussion !== null && message.discussion.number === number
              ? { ...message, discussion: change(message.discussion) }
              : message
          ),
        })
      );
    }
  }
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
    for (const query of localStore.getAllQueries(replies)) {
      if (
        Option.isSome(query.value) &&
        query.args.number === args.number &&
        query.args.paginationOpts.cursor === null
      ) {
        localStore.setQuery(
          replies,
          query.args,
          Option.some({
            ...query.value.value,
            page: [message, ...query.value.value.page],
          })
        );
      }
    }
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
  for (const query of localStore.getAllQueries(reads.get)) {
    if (
      Option.isSome(query.value) &&
      query.args.classId === args.classId &&
      samePlace(query.args.place, args.place)
    ) {
      const at = query.value.value.at;
      localStore.setQuery(
        reads.get,
        query.args,
        Option.some({ at: at === null ? args.at : Num.max(at, args.at) })
      );
    }
  }
  const place = args.place;
  if (place._tag === "discussion") {
    changeDiscussion(localStore, place.number, (discussion) => ({
      ...discussion,
      unread:
        discussion.lastReplyAt !== null && discussion.lastReplyAt > args.at,
    }));
    return;
  }
  for (const query of localStore.getAllQueries(channels.list)) {
    if (
      Option.isSome(query.value) &&
      Arr.some(
        query.value.value.page,
        (channel) => channel.id === place.channelId
      )
    ) {
      localStore.setQuery(
        channels.list,
        query.args,
        Option.some({
          ...query.value.value,
          page: Arr.map(query.value.value.page, (channel) =>
            channel.id === place.channelId
              ? { ...channel, unread: false }
              : channel
          ),
        })
      );
    }
  }
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
    text: null,
  }));
};
