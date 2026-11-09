import { Id } from "@repo/backend/confect/_generated/id";
import {
  DiscussionNumber,
  MessageView,
} from "@repo/backend/confect/classroom/forum/message";
import { useRequired } from "@repo/design-system/hooks/required";
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
 * The thread the last press opened, if any, and the client key of the message whose thread the server is starting,
 * which holds its thread button pressed until the server answers.
 */
const OpeningState = Schema.Struct({
  opened: Schema.Option(OpenedThread),
  starting: Schema.Option(Schema.String),
});

/** The actions that open and forget a pressed thread. They are functions, so this part is a plain shape. */
interface OpeningActions {
  /** Forgets the pressed thread, as its pane closes. */
  readonly forget: () => void;
  /** Keeps the thread a press opened, so the pane draws it before the server answers. */
  readonly keep: (thread: typeof OpenedThread.Type) => void;
  /** Marks the thread of the message with `clientKey` as starting, or none once the server answered. */
  readonly start: (clientKey: Option.Option<string>) => void;
}

/** The pressed thread of one forum, with its actions. */
type OpeningStore = typeof OpeningState.Type & OpeningActions;

/** Creates the pressed thread of one forum, empty until a press. */
export const createOpening = () =>
  createStore<OpeningStore>()((set) => ({
    forget: () => set({ opened: Option.none() }),
    keep: (thread) => set({ opened: Option.some(thread) }),
    opened: Option.none(),
    start: (clientKey) => set({ starting: clientKey }),
    starting: Option.none(),
  }));

/** The pressed thread of the forum around the caller. */
export const OpeningContext = createContext<StoreApi<OpeningStore> | null>(
  null
);

/** Reads one slice of the forum's pressed thread. */
export function useOpening<T>(selector: (state: OpeningStore) => T) {
  const store = useRequired(OpeningContext, "useOpening");

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
