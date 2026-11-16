import { Array as Arr, Schema } from "effect";
import { createStore } from "zustand";

/** The chats of the demo class, in the order its list shows them, the general chat first. */
export const RoomChannel = Schema.Literals(["general", "momentum", "lab"]);

/** A message the reader posted into a chat: the chat, its key in the list, and its text or the name of its file. */
const Posted = Schema.Struct({
  channel: RoomChannel,
  key: Schema.String,
  text: Schema.String,
});

export interface RoomState {
  /** The chat that stands open. */
  readonly channel: typeof RoomChannel.Type;
  /** Opens a chat, which reads its messages. */
  readonly open: (channel: typeof RoomChannel.Type) => void;
  /** The chats the reader has opened, so a chat they read keeps no unread dot. */
  readonly opened: readonly (typeof RoomChannel.Type)[];
  /** Posts the reader's message into the open chat. */
  readonly post: (text: string) => void;
  /** Every message the reader posted, in the order they posted them. */
  readonly posted: readonly (typeof Posted.Type)[];
  /** What the reader searches the list of chats for. */
  readonly query: string;
  readonly search: (query: string) => void;
}

/**
 * Creates the state of the demo forum: the open chat, the chats read, the reader's own messages and the search over
 * the list. It lives as long as the forum's part, and nothing in it leaves the page.
 */
export function createRoomStore() {
  return createStore<RoomState>()((set) => ({
    channel: "momentum",
    open: (channel) =>
      set((state) => ({
        channel,
        opened: Arr.contains(state.opened, channel)
          ? state.opened
          : Arr.append(state.opened, channel),
      })),
    opened: ["momentum"],
    post: (text) =>
      set((state) => ({
        posted: Arr.append(state.posted, {
          channel: state.channel,
          key: `${state.posted.length}`,
          text,
        }),
      })),
    posted: [],
    query: "",
    search: (query) => set({ query }),
  }));
}
