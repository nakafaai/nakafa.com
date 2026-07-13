"use client";

import {
  AudioPlayerContext,
  AudioPlayerTimeContext,
} from "@repo/design-system/components/ui/audio-player-context";
import {
  AudioNetworkState,
  type AudioPlayerApi,
  type AudioPlayerItem,
  type AudioPlayerOperationError,
  AudioReadyState,
  beginAudioPlayerPlayback,
  createAudioPlayerSnapshot,
  pauseAudioPlayer,
  prepareAudioPlayerItem,
  readAudioPlayerSnapshot,
  seekAudioPlayer,
  setAudioPlayerPlaybackRate,
  stabilizeAudioPlayerSnapshot,
} from "@repo/design-system/lib/audio-player";
import { runAudioPlayerProgram } from "@repo/design-system/lib/audio-player-boundary";
import { useAnimationFrame } from "@repo/design-system/lib/use-animation-frame";
import { Effect } from "effect";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * Owns one browser audio element and exposes its playback state to descendants.
 *
 * Cleanup uses an effect because the component synchronizes with the external
 * `HTMLAudioElement` API and must stop playback when its UI unmounts.
 *
 * Related docs: https://react.dev/reference/react/useEffect
 */
export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const itemRef = useRef<AudioPlayerItem | null>(null);
  const pendingPlaybackRef = useRef<Effect.Effect<
    void,
    AudioPlayerOperationError
  > | null>(null);
  const [snapshot, setSnapshot] = useState(createAudioPlayerSnapshot);
  const {
    activeItem,
    duration,
    error,
    networkState,
    paused,
    playbackRate,
    readyState,
    time,
  } = snapshot;

  const syncSnapshot = useCallback(
    (audio: HTMLAudioElement, item: AudioPlayerItem | null) => {
      const nextSnapshot = readAudioPlayerSnapshot(audio, item);
      setSnapshot((current) =>
        stabilizeAudioPlayerSnapshot(current, nextSnapshot)
      );
    },
    []
  );

  const awaitPendingPlayback = useCallback(
    () =>
      Effect.suspend(() => {
        const pendingPlayback = pendingPlaybackRef.current;
        return pendingPlayback ? Effect.ignore(pendingPlayback) : Effect.void;
      }).pipe(Effect.withSpan("designSystem.audioPlayer.awaitPendingPlayback")),
    []
  );

  const setActiveItem = useCallback(
    (item: AudioPlayerItem | null) =>
      Effect.gen(function* () {
        const audio = audioRef.current;
        if (!audio || item?.id === itemRef.current?.id) {
          return;
        }

        yield* awaitPendingPlayback();
        yield* prepareAudioPlayerItem(audio, item);
        itemRef.current = item;
        pendingPlaybackRef.current = null;
        yield* Effect.sync(() => syncSnapshot(audio, item));
      }).pipe(Effect.withSpan("designSystem.audioPlayer.setActiveItem")),
    [awaitPendingPlayback, syncSnapshot]
  );

  const play = useCallback(
    (item?: AudioPlayerItem | null) =>
      Effect.gen(function* () {
        const audio = audioRef.current;
        if (!audio) {
          return;
        }

        yield* awaitPendingPlayback();

        if (item === null) {
          yield* prepareAudioPlayerItem(audio, null);
          itemRef.current = null;
          pendingPlaybackRef.current = null;
          yield* Effect.sync(() => syncSnapshot(audio, null));
          return;
        }

        if (item !== undefined && item.id !== itemRef.current?.id) {
          yield* prepareAudioPlayerItem(audio, item);
          itemRef.current = item;
        }

        const pendingPlayback = yield* beginAudioPlayerPlayback(audio);
        pendingPlaybackRef.current = pendingPlayback;
        yield* Effect.sync(() => syncSnapshot(audio, itemRef.current));
        yield* pendingPlayback;
      }).pipe(Effect.withSpan("designSystem.audioPlayer.play")),
    [awaitPendingPlayback, syncSnapshot]
  );

  const pause = useCallback(
    () =>
      Effect.gen(function* () {
        const audio = audioRef.current;
        if (!audio) {
          return;
        }

        yield* awaitPendingPlayback();
        yield* pauseAudioPlayer(audio);
        pendingPlaybackRef.current = null;
        yield* Effect.sync(() => syncSnapshot(audio, itemRef.current));
      }).pipe(Effect.withSpan("designSystem.audioPlayer.pauseCommand")),
    [awaitPendingPlayback, syncSnapshot]
  );

  const seek = useCallback(
    (nextTime: number) =>
      Effect.gen(function* () {
        const audio = audioRef.current;
        if (!audio) {
          return;
        }

        yield* seekAudioPlayer(audio, nextTime);
        yield* Effect.sync(() => syncSnapshot(audio, itemRef.current));
      }).pipe(Effect.withSpan("designSystem.audioPlayer.seekCommand")),
    [syncSnapshot]
  );

  const setPlaybackRate = useCallback(
    (rate: number) =>
      Effect.gen(function* () {
        const audio = audioRef.current;
        if (!audio) {
          return;
        }

        yield* setAudioPlayerPlaybackRate(audio, rate);
        yield* Effect.sync(() => syncSnapshot(audio, itemRef.current));
      }).pipe(
        Effect.withSpan("designSystem.audioPlayer.setPlaybackRateCommand")
      ),
    [syncSnapshot]
  );

  const isItemActive = useCallback(
    (id: string | number | null) => activeItem?.id === id,
    [activeItem]
  );

  useAnimationFrame(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    syncSnapshot(audio, itemRef.current);
  });

  useEffect(() => {
    const audio = audioRef.current;

    return () => {
      if (!audio) {
        return;
      }

      runAudioPlayerProgram(
        prepareAudioPlayerItem(audio, null),
        "audio-player-cleanup"
      );
    };
  }, []);

  const isPlaying = !paused;
  const isBuffering =
    readyState < AudioReadyState.HAVE_FUTURE_DATA &&
    networkState === AudioNetworkState.NETWORK_LOADING;

  const api = useMemo<AudioPlayerApi>(
    () => ({
      ref: audioRef,
      duration,
      error,
      isPlaying,
      isBuffering,
      activeItem,
      playbackRate,
      isItemActive,
      setActiveItem,
      play,
      pause,
      seek,
      setPlaybackRate,
    }),
    [
      duration,
      error,
      isPlaying,
      isBuffering,
      activeItem,
      playbackRate,
      isItemActive,
      setActiveItem,
      play,
      pause,
      seek,
      setPlaybackRate,
    ]
  );

  return (
    <AudioPlayerContext.Provider value={api}>
      <AudioPlayerTimeContext.Provider value={time}>
        <audio
          aria-label="Audio player"
          className="hidden"
          crossOrigin="anonymous"
          preload="metadata"
          ref={audioRef}
        >
          <track kind="captions" label="Captions" src={undefined} />
        </audio>

        {children}
      </AudioPlayerTimeContext.Provider>
    </AudioPlayerContext.Provider>
  );
}
