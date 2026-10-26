import type { Ref } from "@confect/core";
import type {
  OptimisticLocalStore as LocalStore,
  OptimisticUpdate,
} from "@confect/react";
import type { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { Array as Arr, Option } from "effect";

/** One message of a channel, as the forum shows it. */
export type ForumMessage = Ref.Returns<
  typeof classroom.forum.messages.page
>["page"][number];

const { page } = classroom.forum.messages;

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
 * Shows a message the member sends first in the newest page of its channel, before the server
 * holds it. The page shows newest first, so the message lands at the bottom of the channel.
 */
export const sendUpdate =
  (
    message: ForumMessage
  ): OptimisticUpdate<typeof classroom.forum.messages.send> =>
  (localStore, args) => {
    for (const query of localStore.getAllQueries(page)) {
      if (
        Option.isSome(query.value) &&
        query.args.channelId === args.channelId &&
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
