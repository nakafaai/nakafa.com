import type { Id } from "@repo/backend/convex/_generated/dataModel";
import * as z from "zod/mini";
import { createStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

const replyToSchema = z.object({
  postId: z.string(),
  userName: z.string(),
});

const stateSchema = z.object({
  activeForumId: z.nullable(z.string()),
  replyTo: z.nullable(replyToSchema),
});

type ReplyTo = {
  postId: Id<"schoolClassForumPosts">;
  userName: string;
};

type State = {
  activeForumId: Id<"schoolClassForums"> | null;
  replyTo: ReplyTo | null;
};

type Actions = {
  setActiveForumId: (activeForumId: Id<"schoolClassForums"> | null) => void;
  setReplyTo: (replyTo: ReplyTo | null) => void;
};

export type ForumStore = State & Actions;

const initialState: State = {
  activeForumId: null,
  replyTo: null,
};

export const createForumStore = () =>
  createStore<ForumStore>()(
    persist(
      immer((set, get) => ({
        ...initialState,
        setActiveForumId: (activeForumId) => {
          // Clear replyTo when forum changes
          if (get().activeForumId !== activeForumId) {
            set({ activeForumId, replyTo: null });
          }
        },
        setReplyTo: (replyTo) => set({ replyTo }),
      })),
      {
        name: "nakafa-forum",
        storage: createJSONStorage(() => sessionStorage),
        version: 1,
        migrate: (persistedState) => parsePersistedState(persistedState),
      }
    )
  );

function parsePersistedState(persisted: unknown): State {
  const result = z.safeParse(stateSchema, persisted);
  if (!result.success) {
    return initialState;
  }
  // Merge: initialState provides defaults for new fields, parsed provides validated values
  return { ...initialState, ...result.data } as State;
}
