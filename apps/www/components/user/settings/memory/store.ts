import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import { createStore } from "zustand";
import type { Memory } from "@/components/user/settings/memory/list";

/** What the learner is doing on the Memory page. */
const MemoryStateSchema = Schema.Struct({
  /** The words of a save that failed, which the editor shows when it opens again. */
  draft: Schema.NullOr(Schema.String),
  /** Whether the editor panel is open. */
  open: Schema.Boolean,
  /** The words the learner typed to search. */
  query: Schema.String,
  /** Counts the openings of the editor, so each one starts with fresh words. */
  session: Schema.Int,
  /**
   * The memory in the editor, or none for a new memory. It stays while the
   * panel closes, so the panel does not empty before it is gone.
   */
  target: Schema.NullOr(Id("ninaMemories")),
});

type MemoryState = typeof MemoryStateSchema.Type;

interface MemoryActions {
  /** Closes the editor and forgets any words it was given back. */
  close: () => void;
  /** Opens the editor with one memory. */
  openEdit: (id: Memory["id"]) => void;
  /** Opens the editor for a new memory. */
  openNew: () => void;
  /**
   * Opens the editor again with the words of a save that failed: with the
   * memory `id`, or with a new memory when `id` is null. It leaves an editor
   * the learner opened since, because that editor holds newer words.
   */
  reopen: (id: Memory["id"] | null, text: string) => void;
  /** Sets the words the learner searches for. */
  search: (query: string) => void;
}

export type MemoryStore = MemoryState & MemoryActions;

/** Creates the store of one Memory page, so two pages never share their state. */
export function createMemoryStore() {
  return createStore<MemoryStore>()((set) => ({
    close: () => set({ draft: null, open: false }),
    draft: null,
    open: false,
    openEdit: (id) =>
      set((state) => ({
        draft: null,
        open: true,
        session: state.session + 1,
        target: id,
      })),
    openNew: () =>
      set((state) => ({
        draft: null,
        open: true,
        session: state.session + 1,
        target: null,
      })),
    query: "",
    reopen: (id, text) =>
      set((state) =>
        state.open
          ? state
          : { draft: text, open: true, session: state.session + 1, target: id }
      ),
    search: (query) => set({ query }),
    session: 0,
    target: null,
  }));
}

export type MemoryStoreApi = ReturnType<typeof createMemoryStore>;
