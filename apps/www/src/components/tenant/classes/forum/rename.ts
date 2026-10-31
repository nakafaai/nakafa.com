import type { OptimisticUpdate } from "@confect/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { Array as Arr, Option } from "effect";
import { changeDiscussion } from "@/components/tenant/classes/forum/optimistic";

const { list } = classroom.forum.channels;

/** Shows a channel's new name at once, in every page of the channel list that holds it. */
export const renameChannelUpdate: OptimisticUpdate<
  typeof classroom.forum.channels.rename
> = (localStore, args) => {
  for (const query of localStore.getAllQueries(list)) {
    if (
      Option.isSome(query.value) &&
      Arr.some(
        query.value.value.page,
        (channel) => channel.id === args.channelId
      )
    ) {
      localStore.setQuery(
        list,
        query.args,
        Option.some({
          ...query.value.value,
          page: Arr.map(query.value.value.page, (channel) =>
            channel.id === args.channelId
              ? { ...channel, name: args.name }
              : channel
          ),
        })
      );
    }
  }
};

/** Shows a discussion's new title at once, on its page and on the message that opens it. */
export const renameDiscussionUpdate: OptimisticUpdate<
  typeof classroom.forum.threads.rename
> = (localStore, args) => {
  changeDiscussion(localStore, args.number, (discussion) => ({
    ...discussion,
    title: args.title,
  }));
};
