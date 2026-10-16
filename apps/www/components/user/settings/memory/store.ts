import { Id } from "@repo/backend/confect/_generated/id";
import { NinaMemoryView } from "@repo/backend/confect/nina/memory.spec";
import { Record as Rec, Schema } from "effect";
import { createStore } from "zustand";
import {
  editedMemory,
  type Memory,
  type MemoryDraft,
} from "@/components/user/settings/memory/list";

/** The title and words an editor holds. */
const DraftSchema = Schema.Struct({
  text: Schema.String,
  title: Schema.String,
});

/** What the learner is doing on the Memory page. */
const MemoryStateSchema = Schema.Struct({
  /**
   * How many times the learner deleted every memory. A first save that was on
   * its way when they did learns by it that the server deleted its memory too.
   */
  cleared: Schema.Int,
  /**
   * The memory the learner deleted last, from the list or from the editor. The
   * editor never saves a memory the learner deleted, so a save that was still
   * waiting for its moment cannot bring the memory back or fail as missing, and
   * a save that failed never brings its editor back.
   */
  deleted: Schema.NullOr(Id("ninaMemories")),
  /** The title and words of a save that failed, which the editor shows when it opens again. */
  draft: Schema.NullOr(DraftSchema),
  /** Whether the editor panel is open. */
  open: Schema.Boolean,
  /** The words the learner typed to search. */
  query: Schema.String,
  /** Counts the openings of the editor, so each one starts with fresh words. */
  session: Schema.Int,
  /**
   * The memory the editor opened with, or none for a new memory: its id, title
   * and words, and what its facts line shows. The editor holds it and never
   * looks it up in the list, because a memory that is not in the list is not a
   * deleted memory. It follows what the editor saves, and it stays while the
   * panel closes, so the panel does not empty before it is gone.
   */
  target: Schema.NullOr(NinaMemoryView),
  /**
   * The words an editor still held when the learner deleted its memory, by the
   * id of the memory. The editor does not save them. They come back in an
   * editor when the server does not delete the memory, and each deletion keeps
   * its own. They go once the server has deleted the memory, because the words
   * were never part of what the server stores, or when an editor opens on the
   * memory again.
   */
  withheld: Schema.Record(Schema.String, DraftSchema),
});

type MemoryState = typeof MemoryStateSchema.Type;

interface MemoryActions {
  /**
   * Points the editor at the memory the server just stored for it, so the
   * list marks it and its facts show. It leaves an editor the learner opened
   * since `session`, because that one writes another memory.
   */
  adopt: (session: number, memory: Memory) => void;
  /** Closes the editor and forgets any words it was given back. */
  close: () => void;
  /**
   * Notes that the learner deleted the memory `id`. The editor on it closes,
   * and nothing it still had to save is saved.
   */
  forget: (id: Memory["id"]) => void;
  /**
   * Notes that the learner deleted every memory. The editor on a memory closes
   * as `forget` does, and a first save that is still on its way finds out by
   * `cleared`.
   */
  forgetAll: () => void;
  /**
   * Closes the editor of the opening `session`, because the server answered
   * that its memory is missing. It leaves an editor the learner opened since.
   */
  leave: (session: number) => void;
  /** Opens the editor with one memory. */
  openEdit: (memory: Memory) => void;
  /** Opens the editor for a new memory. */
  openNew: () => void;
  /**
   * Takes back the note that the learner deleted the memory `id`, because the
   * server did not delete it. The memory is in the list again, and the editor
   * saves it again.
   */
  recall: (id: Memory["id"]) => void;
  /**
   * Takes back one count of `forgetAll`, because the server deleted nothing. A
   * first save that was on its way then finds the count it started with, and
   * keeps its editor.
   */
  recallAll: () => void;
  /**
   * Lets go of the words kept for the deleted memory `id`: the server deleted
   * the memory, or the page is giving them back.
   */
  release: (id: Memory["id"]) => void;
  /**
   * Opens the editor again with the draft of a save that failed, on `memory`,
   * or on a new memory when it is null. `session` is the opening the draft
   * comes from. Nothing opens when the learner opened an editor since, open or
   * closed again by now, because what they wrote there is newer than the draft,
   * or when the learner deleted `memory` since.
   */
  reopen: (session: number, draft: MemoryDraft, memory: Memory | null) => void;
  /** Shows the memory the editor holds as the learner just rewrote it. */
  rewrite: (id: Memory["id"], draft: MemoryDraft, now: number) => void;
  /** Sets the words the learner searches for. */
  search: (query: string) => void;
  /**
   * Keeps the words the editor on the deleted memory `id` still held, in case
   * the server does not delete it.
   */
  withhold: (id: Memory["id"], draft: MemoryDraft) => void;
}

export type MemoryStore = MemoryState & MemoryActions;

/**
 * What changes when the learner deletes the memory `id`. The editor on it
 * closes and its opening ends, so a save of that opening that fails later gives
 * no words back, also when the learner has deleted another memory since and
 * `deleted` names that one.
 */
function forgetting(state: MemoryState, id: Memory["id"]) {
  return {
    deleted: id,
    ...(state.target?.id === id
      ? { draft: null, open: false, session: state.session + 1 }
      : {}),
  };
}

/** Creates the store of one Memory page, so two pages never share their state. */
export function createMemoryStore() {
  return createStore<MemoryStore>()((set) => ({
    adopt: (session, memory) =>
      set((state) =>
        state.session === session && state.target === null
          ? { target: memory }
          : state
      ),
    cleared: 0,
    close: () => set({ draft: null, open: false }),
    deleted: null,
    draft: null,
    forget: (id) => set((state) => forgetting(state, id)),
    forgetAll: () =>
      set((state) => ({
        cleared: state.cleared + 1,
        ...(state.target ? forgetting(state, state.target.id) : {}),
      })),
    recall: (id) =>
      set((state) => (state.deleted === id ? { deleted: null } : state)),
    recallAll: () => set((state) => ({ cleared: state.cleared - 1 })),
    leave: (session) =>
      set((state) =>
        state.session === session ? { draft: null, open: false } : state
      ),
    open: false,
    openEdit: (memory) =>
      set((state) => ({
        draft: null,
        open: true,
        session: state.session + 1,
        target: memory,
        withheld: Rec.remove(state.withheld, memory.id),
      })),
    openNew: () =>
      set((state) => ({
        draft: null,
        open: true,
        session: state.session + 1,
        target: null,
      })),
    query: "",
    reopen: (session, draft, memory) =>
      set((state) =>
        state.open ||
        state.session !== session ||
        (memory !== null && memory.id === state.deleted)
          ? state
          : {
              draft,
              open: true,
              session: state.session + 1,
              target: memory,
              withheld:
                memory === null
                  ? state.withheld
                  : Rec.remove(state.withheld, memory.id),
            }
      ),
    release: (id) =>
      set((state) => ({ withheld: Rec.remove(state.withheld, id) })),
    rewrite: (id, draft, now) =>
      set((state) =>
        state.target?.id === id
          ? { target: editedMemory(state.target, draft, now) }
          : state
      ),
    search: (query) => set({ query }),
    session: 0,
    target: null,
    withheld: {},
    withhold: (id, draft) =>
      set((state) => ({ withheld: Rec.set(state.withheld, id, draft) })),
  }));
}

export type MemoryStoreApi = ReturnType<typeof createMemoryStore>;
