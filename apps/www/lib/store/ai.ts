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
        setCurrentMessages: (messages) => {
          const currentMessages = get().currentMessages;
          const combined = [...currentMessages, ...messages];
          const uniqueMessages = Array.from(
            new Map(combined.map((m) => [m.id, m])).values()
          );
          set({ currentMessages: uniqueMessages });
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
