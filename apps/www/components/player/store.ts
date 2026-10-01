import { createStore, type StoreApi } from "zustand";
import type { PlayerMode } from "@/components/player/mode";

/** The one overlay the player shows at a time. */
export type PlayerOverlay = "finish" | "navigator" | "none";

/** A request for the mounted view to scroll to and focus one question. */
export interface PlayerJump {
  readonly key: string;
  readonly seq: number;
}

/** Navigation state that only the player's own actions and observers write. */
interface PlayerViewState {
  /** The question the footer, flag, and digit keys act on. */
  readonly current: string | null;
  readonly jump: PlayerJump | null;
  /** Frozen question order of the attempt. */
  readonly keys: readonly string[];
  readonly mode: PlayerMode;
  /** Latest scroll candidate while a jump holds the current question. */
  readonly observed: string | null;
  readonly overlay: PlayerOverlay;
  /** A jump that waits for the open overlay to finish closing. */
  readonly pending: string | null;
  /** Whether a jump or focus holds the current question against scrolling. */
  readonly pinned: boolean;
}

interface PlayerViewActions {
  readonly close: () => void;
  readonly focus: (key: string) => void;
  readonly goTo: (key: string) => void;
  readonly observe: (key: string) => void;
  readonly open: (overlay: Exclude<PlayerOverlay, "none">) => void;
  readonly release: () => void;
  readonly setMode: (mode: PlayerMode) => void;
  readonly settle: () => void;
  readonly step: (delta: -1 | 1) => void;
}

/** The player's view store: state plus the actions that change it. */
export type PlayerView = PlayerViewState & PlayerViewActions;

/** Creates one view store per player instance, seeded by the server mode. */
export function createPlayerStore(input: {
  readonly keys: readonly string[];
  readonly mode: PlayerMode;
}): StoreApi<PlayerView> {
  return createStore<PlayerView>()((set, get) => {
    /** Reveals a question now, or once the open overlay has closed. */
    function reveal(key: string) {
      const { jump, overlay } = get();
      if (overlay !== "none") {
        set({ overlay: "none", pending: key });
        return;
      }
      set({ jump: { key, seq: (jump?.seq ?? 0) + 1 } });
    }

    return {
      close: () => set({ overlay: "none" }),
      current: input.keys[0] ?? null,
      focus: (key) => set({ current: key, observed: null, pinned: true }),
      goTo: (key) => {
        set({ current: key, observed: null, pinned: true });
        reveal(key);
      },
      jump: null,
      keys: input.keys,
      mode: input.mode,
      observe: (key) => {
        if (get().pinned) {
          set({ observed: key });
          return;
        }
        set({ current: key });
      },
      observed: null,
      open: (overlay) => set({ overlay }),
      overlay: "none",
      pending: null,
      pinned: false,
      release: () => {
        const { current, observed, pinned } = get();
        if (!pinned) {
          return;
        }
        set({ current: observed ?? current, observed: null, pinned: false });
      },
      setMode: (mode) => {
        const { current } = get();
        set({ mode, observed: null, pinned: true });
        if (current !== null) {
          reveal(current);
        }
      },
      settle: () => {
        const { jump, pending } = get();
        if (pending === null) {
          return;
        }
        set({
          jump: { key: pending, seq: (jump?.seq ?? 0) + 1 },
          pending: null,
        });
      },
      step: (delta) => {
        const { current, goTo, keys } = get();
        const next =
          current === null ? undefined : keys[keys.indexOf(current) + delta];
        if (next !== undefined) {
          goTo(next);
        }
      },
    };
  });
}
