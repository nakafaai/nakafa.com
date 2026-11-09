import { type BlockKey, idOf } from "@repo/backend/confect/island/blocks";
import { Array as Arr, HashSet, Schema } from "effect";
import { createContext, use } from "react";
import { createStore, useStore } from "zustand";
import { applyEdits, type Edit, inverseOf } from "@/lib/island/edits";
import type { ItemKey } from "@/lib/island/items";
import type { Weather } from "@/lib/island/sky";
import type { Cells } from "@/lib/island/world";

/** The hand the learner builds with: one block placed per tap, a ready-made item, or the pickaxe that removes a block. */
export type Tool = "place" | "item" | "remove";

/** What the game tells the learner: a build the server refused, edits another device made first, or an item with no room where it was pressed. */
export type Notice = "refused" | "room" | "stale";

/** The learner's lifetime Stars between the level they reached and the next one. */
export const Progress = Schema.Struct({
  from: Schema.Finite,
  lifetime: Schema.Finite,
  next: Schema.optionalKey(Schema.Finite),
});
export type Progress = typeof Progress.Type;

/** How many steps undo keeps. */
const HISTORY = 64;

/**
 * What the game's own actions write (ADR 0047, D5 and D6): the world's cells,
 * which chunks need meshing again, the hotbar and the held slot, the tool, the
 * steps undo and redo walk, whether the block book is open, and the edits the
 * server has not taken yet with the version they build on. The world is one
 * typed array changed in place, so `revision` rises with every change for the
 * readers that draw it.
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
  /** Holds a ready-made item, which the next press places. */
  hold: (item: ItemKey) => void;
  hotbar: readonly BlockKey[];
  /** The ready-made item in hand while the tool is "item". */
  item: ItemKey;
  /** Leaves the game for the page the learner came from. */
  leave: () => void;
  /** The island's level, which opens blocks for building (D7). */
  level: number;
  /** The minute of the learner's day the clock shows, from 0 to 1439. */
  minute: number;
  /** Whether the learner turned the island's sound off. */
  muted: boolean;
  /** What the game tells the learner, none most of the time. */
  notice: Notice | null;
  past: readonly (readonly Edit[])[];
  /** What the server has not taken yet, in the order it changed. */
  pending: readonly Edit[];
  /** The learner's lifetime Stars, the Stars that opened this level, and those that open the next, none at the last. */
  progress: Progress;
  redo: () => void;
  revision: number;
  /**
   * Takes back everything the server has not taken, so the world matches what
   * it holds again, after it refused a batch. Undo then starts afresh.
   */
  rollback: () => void;
  /** The seed the island's terrain and life grow from. */
  seed: number;
  setBook: (book: boolean) => void;
  setMinute: (minute: number) => void;
  setMuted: (muted: boolean) => void;
  setNotice: (notice: Notice | null) => void;
  setTool: (tool: Tool) => void;
  /** Records that the server took the first `count` pending edits, now at `version`. */
  settle: (count: number, version: number) => void;
  setWeather: (weather: Weather) => void;
  slot: number;
  /** Hands the chunks to mesh to the stage and forgets them. */
  takeDirty: () => HashSet.HashSet<number>;
  tool: Tool;
  undo: () => void;
  /** The version of the edits the server holds, which the next batch builds on. */
  version: number;
  /** The weather over the island: the learner's own, clear until it is read (D8). */
  weather: Weather;
}

/** What a game opens with: its world, hotbar, level, progress, the version of its edits, and the way out. */
type GameSetup = Pick<
  GameStore,
  | "cells"
  | "hotbar"
  | "leave"
  | "level"
  | "muted"
  | "progress"
  | "seed"
  | "version"
>;

/** Creates the store of one game, which lives and ends with its provider. */
export function createGameStore(setup: GameSetup) {
  return createStore<GameStore>()((set, get) => {
    /** Writes edits, marks what they change, and queues them for the server, without touching history. */
    const write = (edits: readonly Edit[]) => {
      const touched = applyEdits(get().cells, edits);
      set((state) => ({
        dirty: HashSet.union(state.dirty, touched),
        pending: Arr.appendAll(state.pending, edits),
        revision: state.revision + 1,
      }));
    };
    return {
      ...setup,
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
      choose: (slot) => set({ slot, tool: "place" }),
      dirty: HashSet.empty(),
      future: [],
      hold: (item) => set({ book: false, item, tool: "item" }),
      item: "house",
      minute: 0,
      notice: null,
      past: [],
      pending: [],
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
      setMinute: (minute) => set({ minute }),
      setMuted: (muted) => set({ muted }),
      setNotice: (notice) => set({ notice }),
      setWeather: (weather) => set({ weather }),
      setTool: (tool) => set({ tool }),
      rollback: () => {
        const touched = applyEdits(get().cells, inverseOf(get().pending));
        set((state) => ({
          dirty: HashSet.union(state.dirty, touched),
          future: [],
          past: [],
          pending: [],
          revision: state.revision + 1,
        }));
      },
      settle: (count, settled) =>
        set((state) => ({
          pending: Arr.drop(state.pending, count),
          version: settled,
        })),
      slot: 0,
      takeDirty: () => {
        const { dirty } = get();
        set({ dirty: HashSet.empty() });
        return dirty;
      },
      tool: "place",
      weather: "clear",
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
