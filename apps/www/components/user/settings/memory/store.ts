import { Id } from "@repo/backend/confect/_generated/id";
import { NinaMemoryKind } from "@repo/backend/confect/nina/memory.spec";
import { Schema } from "effect";
import { createStore } from "zustand";
import type {
  Memory,
  MemoryDraft,
} from "@/components/user/settings/memory/list";

/** What the learner is doing on the Memory page. */
const MemoryStateSchema = Schema.Struct({
  /** Whether the editor for a new memory is open at the top of the list. */
  adding: Schema.Boolean,
  /** The words of a save that failed, which the editor that opens again shows. */
  draft: Schema.NullOr(
    Schema.Struct({ kind: NinaMemoryKind, text: Schema.String })
  ),
  /** The memory whose editor is open. Only one editor is open at a time. */
  editing: Schema.NullOr(Id("ninaMemories")),
  /** The words the learner typed to search. */
  query: Schema.String,
});

type MemoryState = typeof MemoryStateSchema.Type;

interface MemoryActions {
  /** Closes whichever editor is open and forgets any words it was given back. */
  close: () => void;

  /** Opens the editor of one memory and closes any other. */
  openEdit: (id: Memory["id"]) => void;
  /** Opens the editor for a new memory and closes any other. */
  openNew: () => void;
  /**
   * Opens an editor again with the words of a save that failed: the editor of
   * the memory `id`, or of a new memory when `id` is null. It leaves an editor
   * the learner opened since, because that editor holds newer words.
   */
  reopen: (id: Memory["id"] | null, draft: MemoryDraft) => void;

  /** Sets the words the learner searches for. */
  search: (query: string) => void;
}

export type MemoryStore = MemoryState & MemoryActions;

/** Creates the store of one Memory page, so two pages never share their state. */
export function createMemoryStore() {
  return createStore<MemoryStore>()((set) => ({
    adding: false,
    close: () => set({ adding: false, draft: null, editing: null }),
    draft: null,
    editing: null,

    openEdit: (id) => set({ adding: false, draft: null, editing: id }),
    openNew: () => set({ adding: true, draft: null, editing: null }),
    query: "",

    reopen: (id, draft) =>
      set((state) =>
        state.adding || state.editing !== null
          ? state
          : { adding: id === null, draft, editing: id }
      ),

    search: (query) => set({ query }),
  }));
}

export type MemoryStoreApi = ReturnType<typeof createMemoryStore>;
