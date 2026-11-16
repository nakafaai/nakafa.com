import { Id } from "@repo/backend/confect/_generated/id";
import {
  DiscussionNumber,
  MessageView,
} from "@repo/backend/confect/classroom/forum/message";
import { Option, Schema } from "effect";
import { createContext, use } from "react";
import { createStore, type StoreApi, useStore } from "zustand";

/**
 * The thread a press opened, which the pane draws at once from the message the reader pressed: its channel, its
 * number, and its opening message with the thread's summary. The server answers for the thread too, and the press
 * makes the pane stand before that answer.
 */
export const OpenedThread = Schema.Struct({
  channelId: Id("classroomChannels"),
  number: DiscussionNumber,
  opening: MessageView,
});

/**
 * The thread the last press opened, if any, the client key of the message whose thread the server is starting,
 * which holds its thread button pressed until the server answers, and the thread the reader reaches for (`warm`): a
 * finger or a pointer pressing its row or button, or the focus on it, so the pane reads its replies before the press
 * lands. A pointer passing over reads nothing, so a sweep across the chat costs no reads.
 */
const OpeningState = Schema.Struct({
  opened: Schema.Option(OpenedThread),
  reaching: Schema.Option(Id("classroomChannels")),
  starting: Schema.Option(Schema.String),
  warm: Schema.Option(OpenedThread),
});

/** The actions that open and forget a pressed thread. They are functions, so this part is a plain shape. */
interface OpeningActions {
  /** Forgets the pressed thread, as its pane closes. */
  readonly forget: () => void;
  /** Keeps the thread a press opened, so the pane draws it before the server answers. */
  readonly keep: (thread: typeof OpenedThread.Type) => void;
  /** Names the thread the reader reaches for, so its replies are read before the press opens it. */
  readonly reach: (thread: typeof OpenedThread.Type) => void;
  /** Names the chat the reader reaches for in the list, so its messages are read before the press opens it. */
  readonly reachChannel: (channelId: Id<"classroomChannels">) => void;
  /** Marks the thread of the message with `clientKey` as starting, or none once the server answered. */
  readonly start: (clientKey: Option.Option<string>) => void;
}

/** The pressed thread of one forum, with its actions. */
type OpeningStore = typeof OpeningState.Type & OpeningActions;

/** Creates the pressed thread of one forum, empty until a press. */
export const createOpening = () =>
  createStore<OpeningStore>()((set) => ({
    forget: () => set({ opened: Option.none(), warm: Option.none() }),
    keep: (thread) => set({ opened: Option.some(thread) }),
    opened: Option.none(),
    reach: (thread) =>
      set((state) =>
        Option.exists(
          state.warm,
          (kept) => kept.opening.clientKey === thread.opening.clientKey
        )
          ? state
          : { warm: Option.some(thread) }
      ),
    reachChannel: (channelId) =>
      set((state) =>
        Option.contains(state.reaching, channelId)
          ? state
          : { reaching: Option.some(channelId) }
      ),
    reaching: Option.none(),
    start: (clientKey) => set({ starting: clientKey }),
    starting: Option.none(),
    warm: Option.none(),
  }));

/** The pressed thread of the forum around the caller. */
export const OpeningContext = createContext<StoreApi<OpeningStore> | null>(
  null
);

/** Reads one slice of the forum's pressed thread. */
export function useOpening<T>(selector: (state: OpeningStore) => T) {
  const store = use(OpeningContext);

  if (store === null) {
    throw new Error("useOpening must be used within a forum");
  }

  return useStore(store, selector);
}

/**
 * The client key of the opening message whose thread stands open beside the channel, if any, so that message keeps
 * its selected look while its thread is open.
 */
export const OpenRootContext = createContext<Option.Option<string>>(
  Option.none()
);

/** Whether the thread of the message with `clientKey` stands open beside its channel. */
export function useIsOpenRoot(clientKey: string) {
  return Option.contains(use(OpenRootContext), clientKey);
}
