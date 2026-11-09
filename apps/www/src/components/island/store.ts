import { type BlockKey, idOf } from "@repo/backend/confect/island/blocks";
import { Array as Arr, HashSet, Schema } from "effect";
import { createContext, use } from "react";
import { createStore, useStore } from "zustand";
import { applyEdits, type Edit, inverseOf } from "@/lib/island/edits";
import { settleOf } from "@/lib/island/gravity";
import type { ItemKey } from "@/lib/island/items";
import type { Season } from "@/lib/island/season";
import type { Weather } from "@/lib/island/sky";
import type { Cells } from "@/lib/island/world";

/** The hand the learner plays with: one block placed per tap, a ready-made item, the pickaxe that removes a block, or their own feet. */
export type Tool = "place" | "item" | "remove" | "walk";

/** What the game tells the learner: a build the server refused, edits another device made first, or an item with no room where it was pressed. */
export type Notice = "path" | "refused" | "room" | "stale";

/** The shelves of the block book: ready-made items, plants, blocks, and the field guide of animals. */
export const Shelf = Schema.Literals(["items", "plants", "blocks", "animals"]);
export type Shelf = typeof Shelf.Type;

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
  /** What the book's search looks for, empty for everything. */
  query: string;
  redo: () => void;
  revision: number;
  /**
   * Takes back everything the server has not taken, so the world matches what
   * it holds again, after it refused a batch. Undo then starts afresh.
   */
  rollback: () => void;
  /** The learner's season, which paints the grass and the leaves (D8). */
  season: Season;
  /** The seed the island's terrain and life grow from. */
  seed: number;
  setBook: (book: boolean) => void;
  setMinute: (minute: number) => void;
  setMuted: (muted: boolean) => void;
  setNotice: (notice: Notice | null) => void;
  setQuery: (query: string) => void;
  setShelf: (shelf: Shelf) => void;
  setTool: (tool: Tool) => void;
  /** Records that the server took the first `count` pending edits, now at `version`. */
  settle: (count: number, version: number) => void;
  setWeather: (weather: Weather) => void;
  /** The book's open shelf. */
  shelf: Shelf;
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
  | "season"
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
        // The world settles at once (D14), and what settles belongs to the same step undo takes back.
        const settled = settleOf(get().cells, edits);
        write(settled);
        const step = Arr.appendAll(edits, settled);
        set((state) => ({
          future: [],
          past: Arr.takeRight(Arr.append(state.past, step), HISTORY),
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
      query: "",
      shelf: "items",
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
      setQuery: (query) => set({ query }),
      setShelf: (shelf) => set({ query: "", shelf }),
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
