import type { MyUIMessage } from "@repo/ai/lib/types";
import { createStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

type State = {
  open: boolean;
  text: string;
  currentMessages: MyUIMessage[];
};

type Actions = {
  setOpen: (open: boolean) => void;
  setText: (text: string) => void;
  setCurrentMessages: (messages: MyUIMessage[]) => void;
  appendCurrentMessages: (messages: MyUIMessage) => void;
  clearCurrentMessages: () => void;
};

export type AiStore = State & Actions;

const initialState: State = {
  open: false,
  text: "",
  currentMessages: [],
};

export const createAiStore = () => {
  return createStore<AiStore>()(
    persist(
      immer((set, get) => ({
        ...initialState,

        setOpen: (open) => set({ open }),
        setText: (text) => set({ text }),
        setCurrentMessages: (messages) => set({ currentMessages: messages }),
        appendCurrentMessages: (message) => {
          const currentMessages = get().currentMessages;
          set({
            currentMessages: [...currentMessages, message],
          });
        },
        clearCurrentMessages: () => set({ currentMessages: [] }),
      })),
      {
        storage: createJSONStorage(() => localStorage),
        name: "ai",
      }
    )
  );
};
