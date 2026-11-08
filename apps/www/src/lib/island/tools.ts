import type { Operation } from "@repo/backend/confect/island/build";
import type { Item } from "@repo/backend/confect/island/item";
import { Array as Arr, Option } from "effect";
import { createStore } from "zustand";

/** A cell named by the first footprint cell of what stands there. */
type Cell = Extract<Operation, { _tag: "remove" }>["at"];

/** A batch of changes, as one undo or redo step. */
type Batch = readonly Operation[];

/**
 * The build tools of one island frame (ADR 0042, D12): whether the owner is
 * building, the item they are about to place and its turn, the placement they
 * picked and whether they are moving it, and the batches that undo and redo
 * their edits. The frame creates one store; the toolbar and the canvas read it.
 */
export function createToolStore() {
  return createStore<{
    readonly building: boolean;
    readonly choice: Option.Option<Item>;
    readonly future: readonly Batch[];
    readonly moving: boolean;
    readonly past: readonly Batch[];
    readonly rotation: number;
    readonly selected: Option.Option<Cell>;
    /** Picks an item to place, or none to pick placements instead. */
    choose: (item: Option.Option<Item>) => void;
    /** Starts building, or ends it and drops what was picked. */
    toggle: () => void;
    /** Turns what is about to be placed or moved a quarter clockwise. */
    rotate: () => void;
    /** Picks the placement that stands on a cell, or none. */
    select: (cell: Option.Option<Cell>) => void;
    /** Moves the picked placement with the next press. */
    move: () => void;
    /** Keeps the undo of an edit and drops what redo held. */
    record: (undo: Batch) => void;
    /** Takes the newest undo batch off its stack, none when there is none. */
    takeUndo: () => Option.Option<Batch>;
    /** Takes the newest redo batch off its stack, none when there is none. */
    takeRedo: () => Option.Option<Batch>;
    /** Keeps the redo of an undo that went through. */
    undone: (redo: Batch) => void;
    /** Keeps the undo of a redo that went through, leaving the rest of redo. */
    redone: (undo: Batch) => void;
    /** Forgets every step, after the island changed elsewhere. */
    forget: () => void;
  }>()((set, get) => ({
    building: false,
    choice: Option.none(),
    choose: (choice) => set({ choice, moving: false, selected: Option.none() }),
    forget: () => set({ future: [], past: [] }),
    future: [],
    move: () => set({ choice: Option.none(), moving: true }),
    moving: false,
    past: [],
    record: (undo) => set({ future: [], past: Arr.append(get().past, undo) }),
    redone: (undo) => set({ past: Arr.append(get().past, undo) }),
    rotate: () => set({ rotation: (get().rotation + 1) % 4 }),
    rotation: 0,
    select: (selected) =>
      set({ choice: Option.none(), moving: false, selected }),
    selected: Option.none(),
    takeRedo: () => {
      const last = Arr.last(get().future);
      set({ future: Arr.dropRight(get().future, 1) });
      return last;
    },
    takeUndo: () => {
      const last = Arr.last(get().past);
      set({ past: Arr.dropRight(get().past, 1) });
      return last;
    },
    toggle: () =>
      set({
        building: !get().building,
        choice: Option.none(),
        moving: false,
        selected: Option.none(),
      }),
    undone: (redo) => set({ future: Arr.append(get().future, redo) }),
  }));
}

/** The store of one frame's build tools. */
export type ToolStore = ReturnType<typeof createToolStore>;
