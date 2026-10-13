import { Array as Arr, Option, Schema } from "effect";
import { createStore } from "zustand";
import { type PlayerMode, PlayerModeSchema } from "@/components/player/mode";
import { readNeighbor } from "@/components/player/order";

/** The one overlay the player shows at a time. */
const PlayerOverlaySchema = Schema.Literals(["finish", "navigator", "none"]);

/** Schema-derived overlay the player shows. */
export type PlayerOverlay = typeof PlayerOverlaySchema.Type;

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
  /** The question that the footer and the keys act on. */
  current: Schema.NullOr(Schema.String),
  jump: Schema.NullOr(PlayerJumpSchema),
  /** The frozen order of the questions of the attempt. */
  keys: Schema.Array(Schema.String),
  mode: PlayerModeSchema,
  /** The question under the reading line while a jump or a focus holds `current`. */
  observed: Schema.NullOr(Schema.String),
  overlay: PlayerOverlaySchema,
  /** The question to reveal once the open overlay has closed. */
  pending: Schema.NullOr(Schema.String),
  /** Whether a jump or a focus holds `current` until the learner scrolls. */
  pinned: Schema.Boolean,
});

type PlayerState = typeof PlayerStateSchema.Type;

interface PlayerActions {
  /** Closes the open overlay. */
  close: () => void;
  /** Holds `current` on the question that has the learner's focus. */
  focus: (key: string) => void;
  /** Makes one question current and reveals it. */
  goTo: (key: string) => void;
  /** Records the question under the reading line. */
  observe: (key: string) => void;
  /** Opens one overlay in place of any other. */
  open: (overlay: Exclude<PlayerOverlay, "none">) => void;
  /** Lets the reading line decide `current` again after the learner scrolls. */
  release: () => void;
  /** Shows the other view and reveals the current question in it. */
  setMode: (mode: PlayerMode) => void;
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

    return {
      close: () => set({ overlay: "none" }),
      current: Option.getOrNull(Arr.head(input.keys)),
      focus: (key) => set({ current: key, observed: null, pinned: true }),
      goTo: (key) => {
        set({ current: key, observed: null, pinned: true });
        reveal(key);
      },
      jump: null,
      keys: input.keys,
      mode: input.mode,
      observe: (key) =>
        set(get().pinned ? { observed: key } : { current: key }),
      observed: null,
      open: (overlay) => set({ overlay }),
      overlay: "none",
      pending: null,
      pinned: false,
      release: () =>
        set((state) =>
          state.pinned
            ? {
                current: state.observed ?? state.current,
                observed: null,
                pinned: false,
              }
            : state
        ),
      setMode: (mode) => {
        const { current } = get();
        set({ mode, observed: null, pinned: true });
        if (current !== null) {
          reveal(current);
        }
      },
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
