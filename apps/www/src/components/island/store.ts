import { type BlockKey, idOf } from "@repo/backend/confect/island/blocks";
import { Array as Arr, HashSet } from "effect";
import { createContext, use } from "react";
import { createStore, useStore } from "zustand";
import { applyEdits, type Edit, inverseOf } from "@/lib/island/edits";
import type { Cells } from "@/lib/island/world";

/** The hand the learner builds with: one block placed per tap, or the pickaxe that removes one. */
export type Tool = "place" | "remove";

/** How many steps undo keeps. */
const HISTORY = 64;

/**
 * What the game's own actions write (ADR 0047, D5 and D6): the world's cells,
 * which chunks need meshing again, the hotbar and the held slot, the tool, the
 * steps undo and redo walk, and whether the block book is open. The world is
 * one typed array changed in place, so `revision` rises with every change for
 * the readers that draw it.
 */
interface GameStore {
  /** Writes edits into the world as one step the learner can undo. */
  apply: (edits: readonly Edit[]) => void;
  /** Puts a block into a hotbar slot. */
  assign: (slot: number, key: BlockKey) => void;
  book: boolean;
  cells: Cells;
  /** Holds a hotbar slot, and the block in it. */
  choose: (slot: number) => void;
  /** The chunks whose meshes no longer match the world. */
  dirty: HashSet.HashSet<number>;
  future: readonly (readonly Edit[])[];
  hotbar: readonly BlockKey[];
  /** The island's level, which opens blocks for building (D7). */
  level: number;
  past: readonly (readonly Edit[])[];
  redo: () => void;
  revision: number;
  setBook: (book: boolean) => void;
  setTool: (tool: Tool) => void;
  slot: number;
  /** Hands the chunks to mesh to the stage and forgets them. */
  takeDirty: () => HashSet.HashSet<number>;
  tool: Tool;
  undo: () => void;
}

/** Creates the store of one game, which lives and ends with its provider. */
export function createGameStore(
  cells: Cells,
  hotbar: readonly BlockKey[],
  level: number
) {
  return createStore<GameStore>()((set, get) => {
    /** Writes edits and marks what they change, without touching history. */
    const write = (edits: readonly Edit[]) => {
      const touched = applyEdits(get().cells, edits);
      set((state) => ({
        dirty: HashSet.union(state.dirty, touched),
        revision: state.revision + 1,
      }));
    };
    return {
      apply: (edits) => {
        if (edits.length === 0) {
          return;
        }
        write(edits);
        set((state) => ({
          future: [],
          past: Arr.takeRight(Arr.append(state.past, edits), HISTORY),
        }));
      },
      assign: (slot, key) =>
        set((state) => ({
          hotbar: Arr.map(state.hotbar, (current, index) =>
            index === slot ? key : current
          ),
          slot,
          tool: "place",
        })),
      book: false,
      cells,
      choose: (slot) => set({ slot, tool: "place" }),
      dirty: HashSet.empty(),
      future: [],
      hotbar,
      level,
      past: [],
      redo: () => {
        const step = Arr.last(get().future);
        if (step._tag === "None") {
          return;
        }
        write(step.value);
        set((state) => ({
          future: Arr.dropRight(state.future, 1),
          past: Arr.append(state.past, step.value),
        }));
      },
      revision: 0,
      setBook: (book) => set({ book }),
      setTool: (tool) => set({ tool }),
      slot: 0,
      takeDirty: () => {
        const { dirty } = get();
        set({ dirty: HashSet.empty() });
        return dirty;
      },
      tool: "place",
      undo: () => {
        const step = Arr.last(get().past);
        if (step._tag === "None") {
          return;
        }
        write(inverseOf(step.value));
        set((state) => ({
          future: Arr.append(state.future, step.value),
          past: Arr.dropRight(state.past, 1),
        }));
      },
    };
  });
}

/** The id of the block the learner holds, none while the pickaxe is out. */
export function heldOf(state: Pick<GameStore, "hotbar" | "slot" | "tool">) {
  return state.tool === "remove" ? 0 : idOf(state.hotbar[state.slot]);
}

export type GameStoreApi = ReturnType<typeof createGameStore>;

export const GameStoreContext = createContext<GameStoreApi | null>(null);

/** Reads one value of the game's store. */
export function useGame<T>(selector: (state: GameStore) => T) {
  const store = use(GameStoreContext);
  if (store === null) {
    throw new Error("useGame must be used within the island game");
  }
  return useStore(store, selector);
}
