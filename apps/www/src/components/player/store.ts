import { Array as Arr, Effect, Option, Schema } from "effect";
import { createStore } from "zustand";
import { type PlayerMode, PlayerModeSchema } from "@/components/player/mode";
import { readNeighbor } from "@/components/player/order";

/** The one overlay the player shows at a time. */
const PlayerOverlaySchema = Schema.Literals(["finish", "navigator", "none"]);

/** Schema-derived overlay the player shows. */
export type PlayerOverlay = typeof PlayerOverlaySchema.Type;

/** How the save of a chosen view ended. */
const PlayerChoiceSchema = Schema.Literals(["reverted", "saved", "superseded"]);

type PlayerChoice = typeof PlayerChoiceSchema.Type;

/**
 * A request for the mounted questions to reveal one question. `seq` counts the
 * requests, so asking for the same question twice reveals it twice.
 */
const PlayerJumpSchema = Schema.Struct({
  key: Schema.String,
  seq: Schema.Int,
});

type PlayerJump = typeof PlayerJumpSchema.Type;

/** What the learner is doing in the player, written only by its own actions and observers. */
const PlayerStateSchema = Schema.Struct({
  /** Where a jump or a focus left the page, in pixels from the top, once the page has settled there. */
  anchor: Schema.NullOr(Schema.Finite),
  /** Counts the views the learner chose, so a failed save knows whether a newer choice replaced it. */
  choice: Schema.Int,
  /** The question that the footer and the keys act on. */
  current: Schema.NullOr(Schema.String),
  jump: Schema.NullOr(PlayerJumpSchema),
  /** The frozen order of the questions of the attempt. */
  keys: Schema.Array(Schema.String),
  mode: PlayerModeSchema,
  overlay: PlayerOverlaySchema,
  /** The question to reveal once the open overlay has closed. */
  pending: Schema.NullOr(Schema.String),
  /** Whether a jump or a focus holds `current` until the page moves away from its anchor. */
  pinned: Schema.Boolean,
  /** The view the server knows: the one it resolved, or the last one it saved. */
  saved: PlayerModeSchema,
});

type PlayerState = typeof PlayerStateSchema.Type;

interface PlayerActions {
  /**
   * Records where the page rests once a jump or a focus has scrolled it. While
   * the page stays there, the question that the jump or the focus chose stays
   * current.
   */
  anchorAt: (position: number) => void;
  /**
   * Shows a view at once and saves it. When the save fails, the last saved view
   * comes back, unless the learner chose another view since.
   */
  choose: (
    mode: PlayerMode,
    save: Effect.Effect<boolean>
  ) => Effect.Effect<PlayerChoice>;
  /** Closes the open overlay. */
  close: () => void;
  /** Holds `current` on the question that has the learner's focus. */
  focus: (key: string) => void;
  /** Makes one question current and reveals it. */
  goTo: (key: string) => void;
  /**
   * Reports that the page is at `position`. When that is not where a jump or a
   * focus left it, the page moved away from the hold, and the reading line decides
   * `current` again from its next observation. A page move while an overlay is open
   * is the overlay's scroll lock at work, so it never releases the hold.
   */
  moved: (position: number) => void;
  /**
   * Records the question under the reading line. While a jump or a focus holds
   * `current`, the reading line changes nothing: the held question stays current
   * until the learner moves the page away from it.
   */
  observe: (key: string) => void;
  /** Opens one overlay in place of any other. */
  open: (overlay: Exclude<PlayerOverlay, "none">) => void;
  /** Reveals the question that waited for an overlay to finish closing. */
  settle: () => void;
  /** Goes to the question before or after the current one. */
  step: (delta: -1 | 1) => void;
}

/** The player store: what the learner is doing, and the actions that change it. */
export type PlayerStore = PlayerState & PlayerActions;

/** The store of one player instance. */
export type PlayerStoreApi = ReturnType<typeof createPlayerStore>;

/** The request that follows `previous` and reveals `key`. */
function jumpTo(previous: PlayerJump | null, key: string): PlayerJump {
  return { key, seq: (previous?.seq ?? 0) + 1 };
}

/**
 * Creates the store of one player, so two players never share their state. It
 * starts on the first question, in the view the server resolved.
 */
export function createPlayerStore(input: {
  keys: readonly string[];
  mode: PlayerMode;
}) {
  return createStore<PlayerStore>()((set, get) => {
    /** Reveals a question now, or once the open overlay has finished closing. */
    function reveal(key: string) {
      const { jump, overlay } = get();
      if (overlay !== "none") {
        set({ overlay: "none", pending: key });
        return;
      }
      set({ jump: jumpTo(jump, key) });
    }

    /** Shows a view and reveals the current question in it. */
    function show(mode: PlayerMode) {
      const { current } = get();
      set({ anchor: null, mode, pinned: true });
      if (current !== null) {
        reveal(current);
      }
    }

    return {
      anchor: null,
      anchorAt: (position) =>
        set((state) => (state.pinned ? { anchor: position } : state)),
      choice: 0,
      choose: Effect.fn("player.mode.choose")(function* (mode, save) {
        const choice = get().choice + 1;
        set({ choice });
        show(mode);
        if (yield* save) {
          set({ saved: mode });
          return "saved";
        }
        if (get().choice !== choice) {
          return "superseded";
        }
        show(get().saved);
        return "reverted";
      }),
      close: () => set({ overlay: "none" }),
      current: Option.getOrNull(Arr.head(input.keys)),
      focus: (key) => set({ anchor: null, current: key, pinned: true }),
      goTo: (key) => {
        set({ anchor: null, current: key, pinned: true });
        reveal(key);
      },
      jump: null,
      keys: input.keys,
      mode: input.mode,
      moved: (position) =>
        set((state) =>
          state.pinned &&
          state.overlay === "none" &&
          state.anchor !== null &&
          state.anchor !== position
            ? { anchor: null, pinned: false }
            : state
        ),
      observe: (key) =>
        set((state) => (state.pinned ? state : { current: key })),
      open: (overlay) => set({ overlay }),
      overlay: "none",
      pending: null,
      pinned: false,
      saved: input.mode,
      settle: () => {
        const { jump, pending } = get();
        if (pending !== null) {
          set({ jump: jumpTo(jump, pending), pending: null });
        }
      },
      step: (delta) => {
        const { current, keys } = get();
        const next = readNeighbor(keys, current, delta);
        if (Option.isSome(next)) {
          get().goTo(next.value);
        }
      },
    };
  });
}
