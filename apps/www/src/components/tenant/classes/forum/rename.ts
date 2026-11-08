import type { OptimisticUpdate } from "@confect/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { Array as Arr, Option } from "effect";
import { changeDiscussion } from "@/components/tenant/classes/forum/optimistic";
import { changeLoaded, withPage } from "@/lib/data/loaded";

const { list } = classroom.forum.channels;

/** Shows a channel's new name at once, in every page of the channel list that holds it. */
export const renameChannelUpdate: OptimisticUpdate<
  typeof classroom.forum.channels.rename
> = (localStore, args) => {
  changeLoaded(localStore, list, (value) =>
    Arr.some(value.page, (channel) => channel.id === args.channelId)
      ? Option.some(
          withPage(value, (page) =>
            Arr.map(page, (channel) =>
              channel.id === args.channelId
                ? { ...channel, name: args.name }
                : channel
            )
          )
        )
      : Option.none()
  );
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
