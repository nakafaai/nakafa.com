import type {
  OptimisticLocalStore as LocalStore,
  OptimisticUpdate,
} from "@confect/react";
import type { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import type { ChannelView } from "@repo/backend/confect/classroom/forum/channel";
import { Array as Arr, Option } from "effect";

const { list } = classroom.forum.channels;

/** Writes what `change` makes of each page of the channel list that holds the channel. */
const changePages = (
  localStore: LocalStore.OptimisticLocalStore,
  channelId: Id<"classroomChannels">,
  change: (
    page: readonly (typeof ChannelView.Type)[]
  ) => (typeof ChannelView.Type)[]
) => {
  for (const query of localStore.getAllQueries(list)) {
    if (
      Option.isSome(query.value) &&
      Arr.some(query.value.value.page, (channel) => channel.id === channelId)
    ) {
      localStore.setQuery(
        list,
        query.args,
        Option.some({
          ...query.value.value,
          page: change(query.value.value.page),
        })
      );
    }
  }
};

/** Moves a channel to the archived chats, or back, at once. */
export const archiveChannelUpdate: OptimisticUpdate<
  typeof classroom.forum.channels.archive
> = (localStore, args) => {
  changePages(localStore, args.channelId, (page) =>
    Arr.map(page, (channel) =>
      channel.id === args.channelId
        ? { ...channel, archived: args.archived }
        : channel
    )
  );
};

/** Takes a removed channel out of the list at once. */
export const removeChannelUpdate: OptimisticUpdate<
  typeof classroom.forum.channels.remove
> = (localStore, args) => {
  changePages(localStore, args.channelId, (page) =>
    Arr.filter(page, (channel) => channel.id !== args.channelId)
  );
};
