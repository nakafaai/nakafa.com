import { Array as Arr, Schema } from "effect";
import { createStore } from "zustand";

/**
 * The channel names the list shows while the server saves them. A channel name is
 * unique within its class, so the name keys its draft row.
 */
const DraftsState = Schema.Struct({
  names: Schema.Array(Schema.String),
});

/** The actions that start and end the saving of one channel. */
interface DraftsActions {
  /** Ends the saving of a channel, once the server answered or refused it. */
  readonly end: (name: string) => void;
  /** Starts the saving of a channel, so its row in the list is inert until the server answers. */
  readonly start: (name: string) => void;
}

/** The state of the channels that are being saved, with its actions. */
export type ChannelDrafts = typeof DraftsState.Type & DraftsActions;

/** Creates the drafts of one class page. Each page creates its own, once. */
export const createChannelDrafts = () =>
  createStore<ChannelDrafts>()((set) => ({
    end: (name) =>
      set((state) => ({
        names: Arr.filter(state.names, (current) => current !== name),
      })),
    names: [],
    start: (name) => set((state) => ({ names: Arr.append(state.names, name) })),
  }));
