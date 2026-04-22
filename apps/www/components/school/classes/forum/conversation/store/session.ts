import { createStore } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { ReplyTo } from "@/components/school/classes/forum/conversation/data/entities";

interface State {
  replyTo: ReplyTo | null;
}

interface Actions {
  setReplyTo: (replyTo: ReplyTo | null) => void;
}

export type SessionStore = State & Actions;

const initialState: State = {
  replyTo: null,
};

/** Creates one class-scoped session store for reply state only. */
export function createSessionStore() {
  return createStore<SessionStore>()(
    immer((set) => ({
      ...initialState,

      setReplyTo: (replyTo) => {
        set((state) => {
          state.replyTo = replyTo;
        });
      },
    }))
  );
}
