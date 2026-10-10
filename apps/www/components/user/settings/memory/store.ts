import { Id } from "@repo/backend/confect/_generated/id";
import { NinaMemoryKind } from "@repo/backend/confect/nina/memory.spec";
import { Array as Arr, Schema } from "effect";
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
  /** Memories that wait for an Undo and must not show. */
  removed: Schema.Array(Id("ninaMemories")),
});

type MemoryState = typeof MemoryStateSchema.Type;

interface MemoryActions {
  /** Closes whichever editor is open and forgets any words it was given back. */
  close: () => void;
  /** Hides a memory while the learner can still undo its removal. */
  hide: (id: Memory["id"]) => void;
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
  /**
   * Stops hiding a memory and says whether it was hidden. An Undo calls it to
   * bring the memory back, and the close of the toast calls it to claim the
   * removal, so only one of the two can ever act on a memory.
   */
  restore: (id: Memory["id"]) => boolean;
  /** Sets the words the learner searches for. */
  search: (query: string) => void;
}

export type MemoryStore = MemoryState & MemoryActions;

/** Creates the store of one Memory page, so two pages never share their state. */
export function createMemoryStore() {
  return createStore<MemoryStore>()((set, get) => ({
    adding: false,
    close: () => set({ adding: false, draft: null, editing: null }),
    draft: null,
    editing: null,
    hide: (id) =>
      set((state) => ({
        removed: Arr.contains(state.removed, id)
          ? state.removed
          : Arr.append(state.removed, id),
      })),
    openEdit: (id) => set({ adding: false, draft: null, editing: id }),
    openNew: () => set({ adding: true, draft: null, editing: null }),
    query: "",
    removed: [],
    reopen: (id, draft) =>
      set((state) =>
        state.adding || state.editing !== null
          ? state
          : { adding: id === null, draft, editing: id }
      ),
    restore: (id) => {
      const hidden = Arr.contains(get().removed, id);

      if (hidden) {
        set((state) => ({
          removed: Arr.filter(state.removed, (other) => other !== id),
        }));
      }

      return hidden;
    },
    search: (query) => set({ query }),
  }));
}

export type MemoryStoreApi = ReturnType<typeof createMemoryStore>;
