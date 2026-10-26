import { Id } from "@repo/backend/confect/_generated/id";
import { Match, Schema } from "effect";
import { createStore } from "zustand";

/**
 * How one editor shows its questions: `pages`, the canvas of pages beside the teacher's panel, or `grid`,
 * every question as a tile in place of both, as a design tool's grid view. `reveal` is the question the
 * canvas brings into view when it shows again, as the tile the teacher opened, or none.
 */
const ViewState = Schema.Struct({
  mode: Schema.Literals(["pages", "grid"]),
  reveal: Schema.NullOr(Id("examQuestions")),
});

/** The state of one editor's view, with its actions. */
export type EditorView = typeof ViewState.Type & {
  /** Shows the canvas again with one question in view, as opening a tile does. */
  readonly open: (questionId: typeof ViewState.Type.reveal) => void;
  /** Ends the reveal once the canvas has brought the question into view. */
  readonly settle: () => void;
  /** Shows the grid in place of the canvas, or the canvas again, as the footer's grid button does. */
  readonly toggleGrid: () => void;
};

/** Creates the view of one editor, which starts on the canvas of pages. */
export const createEditorView = () =>
  createStore<EditorView>()((set) => ({
    mode: "pages",
    open: (reveal) => set({ mode: "pages", reveal }),
    reveal: null,
    settle: () => set({ reveal: null }),
    toggleGrid: () =>
      set((state) => ({ mode: state.mode === "grid" ? "pages" : "grid" })),
  }));

/** The keys that move between the tiles of the grid. */
export const TileKey = Schema.Literals([
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "End",
  "Home",
]);

/**
 * The tile that a key moves to in a grid of `count` tiles laid out in `columns` columns: the next or the
 * previous one across, the one below or above, or the first or the last. A move past an edge stays on the
 * nearest tile.
 */
export const tileAfter = (
  key: typeof TileKey.Type,
  from: number,
  layout: { readonly columns: number; readonly count: number }
): number => {
  const last = layout.count - 1;
  const next = Match.value(key).pipe(
    Match.when("ArrowRight", () => from + 1),
    Match.when("ArrowLeft", () => from - 1),
    Match.when("ArrowDown", () => from + layout.columns),
    Match.when("ArrowUp", () => from - layout.columns),
    Match.when("Home", () => 0),
    Match.when("End", () => last),
    Match.exhaustive
  );
  return Math.min(Math.max(next, 0), last);
};
