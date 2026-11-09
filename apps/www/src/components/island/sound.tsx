import { readLocalStorageValue } from "@mantine/hooks";
import { lazy } from "@repo/design-system/lib/lazy";
import { Effect, Option, Schema } from "effect";
import {
  createContext,
  type ReactNode,
  Suspense,
  use,
  useEffect,
  useState,
} from "react";
import { useStore } from "zustand";
import type { Cue } from "@/lib/island/music";
import { createSoundStore } from "@/lib/island/sound";

/** The island's audio, loaded only once the owner's first press opened sound (ADR 0042, D17). */
const IslandAudio = lazy(() => import("@/components/island/audio"));

/** Where this browser remembers that its owner turned the island's sound off, as JSON. */
const MUTED_KEY = "nakafa-island-muted";
const MutedJson = Schema.fromJsonString(Schema.Boolean);

/** The sound store of one island frame, holding the browser's audio context. */
type SoundStore = ReturnType<typeof createSoundStore<AudioContext>>;

const SoundContext = createContext<SoundStore | null>(null);

/** Remembers the owner's choice in this browser; a browser that keeps nothing asks again next visit. */
function rememberMuted(muted: boolean) {
  Effect.runSync(
    Schema.encodeEffect(MutedJson)(muted).pipe(
      Effect.flatMap((text) =>
        Effect.try(() => window.localStorage.setItem(MUTED_KEY, text))
      ),
      Effect.ignore
    )
  );
}

/**
 * Gives one island frame its sound (ADR 0042, D19, D26). Browsers let a page
 * play sound only after a press, so the first press or key on the page opens
 * the audio context, unless the owner turned sound off, and the audio module
 * loads then. The owner's choice stays in this browser.
 */
export function SoundProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() =>
    createSoundStore<AudioContext>(
      readLocalStorageValue({ defaultValue: false, key: MUTED_KEY })
    )
  );
  const opened = useStore(store, (state) => Option.isSome(state.context));
  useEffect(() => {
    const open = () => {
      const state = store.getState();
      if (!state.muted && Option.isNone(state.context)) {
        state.open(new AudioContext());
      }
    };
    window.addEventListener("pointerdown", open, { capture: true, once: true });
    window.addEventListener("keydown", open, { capture: true, once: true });
    return () => {
      window.removeEventListener("pointerdown", open, { capture: true });
      window.removeEventListener("keydown", open, { capture: true });
    };
  }, [store]);
  useEffect(
    () =>
      store.subscribe((state, before) => {
        if (state.muted !== before.muted) {
          rememberMuted(state.muted);
        }
      }),
    [store]
  );
  return (
    <SoundContext value={store}>
      {children}
      {opened ? (
        <Suspense fallback={null}>
          <IslandAudio />
        </Suspense>
      ) : null}
    </SoundContext>
  );
}

/** The sound store of the surrounding frame, for the audio and the switch. */
export function useSoundStore() {
  const store = use(SoundContext);
  if (!store) {
    throw new Error("useSoundStore must be used within SoundProvider");
  }
  return store;
}

/** Plays a cue for a press, when sound is on. */
export function useCue() {
  const store = useSoundStore();
  return (cue: Cue) => store.getState().play(cue);
}

/**
 * The owner's one sound switch: whether sound is on, and the press that turns
 * it off or on. Turning it on is a press, so it opens the audio context when
 * none is open yet.
 */
export function useSoundSwitch() {
  const store = useSoundStore();
  const on = useStore(store, (state) => !state.muted);
  return {
    flip: () => {
      const state = store.getState();
      if (state.muted && Option.isNone(state.context)) {
        state.open(new AudioContext());
      }
      state.toggle();
    },
    on,
  };
}
