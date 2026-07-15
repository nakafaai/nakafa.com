import { Effect, Schema } from "effect";
import type { RefObject } from "react";

/** Browser ready-state values used to derive buffering state. */
export const AudioReadyState = {
  HAVE_NOTHING: 0,
  HAVE_METADATA: 1,
  HAVE_CURRENT_DATA: 2,
  HAVE_FUTURE_DATA: 3,
  HAVE_ENOUGH_DATA: 4,
} as const;

/** Browser network-state values used to derive buffering state. */
export const AudioNetworkState = {
  NETWORK_EMPTY: 0,
  NETWORK_IDLE: 1,
  NETWORK_LOADING: 2,
  NETWORK_NO_SOURCE: 3,
} as const;

const AudioPlayerOperationSchema = Schema.Literal(
  "pause",
  "play",
  "prepare-item",
  "seek",
  "set-playback-rate"
);

/** A browser audio operation that can fail through the player API. */
export type AudioPlayerOperation = Schema.Schema.Type<
  typeof AudioPlayerOperationSchema
>;

/** Expected failure raised by a browser media operation. */
export class AudioPlayerOperationError extends Schema.TaggedError<AudioPlayerOperationError>()(
  "AudioPlayerOperationError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
    operation: AudioPlayerOperationSchema,
  }
) {}

/** Expected failure raised before an empty audio source reaches the browser. */
export class InvalidAudioPlayerSourceError extends Schema.TaggedError<InvalidAudioPlayerSourceError>()(
  "InvalidAudioPlayerSourceError",
  {
    itemId: Schema.Union(Schema.String, Schema.Number),
    message: Schema.String,
  }
) {}

/** Every expected failure exposed by audio player commands. */
export type AudioPlayerError =
  | AudioPlayerOperationError
  | InvalidAudioPlayerSourceError;

/** One playable source and the caller-owned data associated with it. */
export interface AudioPlayerItem<TData = unknown> {
  data?: TData;
  id: string | number;
  src: string;
}

/** Reactive playback state mirrored from the browser audio element. */
export interface AudioPlayerSnapshot {
  activeItem: AudioPlayerItem | null;
  duration: number | undefined;
  error: MediaError | null;
  networkState: number;
  paused: boolean;
  playbackRate: number;
  readyState: number;
  time: number;
}

/** Commands and playback state exposed by an audio player provider. */
export interface AudioPlayerApi {
  activeItem: AudioPlayerItem | null;
  duration: number | undefined;
  error: MediaError | null;
  isBuffering: boolean;
  /** Tests an item identity without changing playback. */
  isItemActive: (id: string | number | null) => boolean;
  isPlaying: boolean;
  /** Awaits pending playback, then pauses; it is a no-op before mount. */
  pause: () => Effect.Effect<void, AudioPlayerError>;
  /** Resumes when omitted, prepares an item when supplied, or clears on null. */
  play: (
    item?: AudioPlayerItem | null
  ) => Effect.Effect<void, AudioPlayerError>;
  playbackRate: number;
  ref: RefObject<HTMLAudioElement | null>;
  /** Moves the mounted media element without changing the active item. */
  seek: (time: number) => Effect.Effect<void, AudioPlayerError>;
  /** Prepares an item without autoplay, or clears the current source on null. */
  setActiveItem: (
    item: AudioPlayerItem | null
  ) => Effect.Effect<void, AudioPlayerError>;
  /** Updates the mounted media element while preserving the active source. */
  setPlaybackRate: (rate: number) => Effect.Effect<void, AudioPlayerError>;
}

/** Formats elapsed seconds for the player time readouts. */
export function formatAudioPlayerTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
  const formattedSeconds =
    remainingSeconds < 10 ? `0${remainingSeconds}` : remainingSeconds;

  return hours > 0
    ? `${hours}:${formattedMinutes}:${formattedSeconds}`
    : `${minutes}:${formattedSeconds}`;
}

/** Creates the initial state mirrored from a browser audio element. */
export function createAudioPlayerSnapshot(): AudioPlayerSnapshot {
  return {
    activeItem: null,
    duration: undefined,
    error: null,
    networkState: AudioNetworkState.NETWORK_EMPTY,
    paused: true,
    playbackRate: 1,
    readyState: AudioReadyState.HAVE_NOTHING,
    time: 0,
  };
}

/** Reads the current browser audio element state as one render snapshot. */
export function readAudioPlayerSnapshot(
  audio: HTMLAudioElement,
  activeItem: AudioPlayerItem | null
): AudioPlayerSnapshot {
  return {
    activeItem,
    duration: audio.duration,
    error: audio.error,
    networkState: audio.networkState,
    paused: audio.paused,
    playbackRate: audio.playbackRate,
    readyState: audio.readyState,
    time: audio.currentTime,
  };
}

/** Reuses the current snapshot when every browser-backed value is unchanged. */
export function stabilizeAudioPlayerSnapshot(
  current: AudioPlayerSnapshot,
  next: AudioPlayerSnapshot
) {
  if (
    current.activeItem === next.activeItem &&
    current.duration === next.duration &&
    current.error === next.error &&
    current.networkState === next.networkState &&
    current.paused === next.paused &&
    current.playbackRate === next.playbackRate &&
    current.readyState === next.readyState &&
    current.time === next.time
  ) {
    return current;
  }

  return next;
}

/** Converts an unknown browser failure into the player error contract. */
function operationError(operation: AudioPlayerOperation, cause: unknown) {
  return new AudioPlayerOperationError({
    cause,
    message: `Audio player operation "${operation}" failed.`,
    operation,
  });
}

/** Resets the media element and loads one source without starting playback. */
export const prepareAudioPlayerItem = Effect.fn(
  "designSystem.audioPlayer.prepareItem"
)(function* (audio: HTMLAudioElement, item: AudioPlayerItem | null) {
  if (item !== null && item.src.trim().length === 0) {
    return yield* new InvalidAudioPlayerSourceError({
      itemId: item.id,
      message: `Audio item "${item.id}" has an empty source.`,
    });
  }

  yield* Effect.try({
    try: () => {
      const currentRate = audio.playbackRate;
      if (!audio.paused) {
        audio.pause();
      }
      audio.currentTime = 0;
      if (item === null) {
        audio.removeAttribute("src");
      } else {
        audio.src = item.src;
      }
      audio.load();
      audio.playbackRate = currentRate;
    },
    catch: (cause) => operationError("prepare-item", cause),
  });
});

/** Starts playback once and returns an Effect that awaits that exact request. */
export const beginAudioPlayerPlayback = Effect.fn(
  "designSystem.audioPlayer.beginPlayback"
)(function* (audio: HTMLAudioElement) {
  const playback = yield* Effect.try({
    try: () => audio.play(),
    catch: (cause) => operationError("play", cause),
  });

  return Effect.tryPromise({
    try: () => playback,
    catch: (cause) => operationError("play", cause),
  });
});

/** Pauses the browser media element through the typed error channel. */
export const pauseAudioPlayer = Effect.fn("designSystem.audioPlayer.pause")(
  (audio: HTMLAudioElement) =>
    Effect.try({
      try: () => audio.pause(),
      catch: (cause) => operationError("pause", cause),
    })
);

/** Changes the browser media position through the typed error channel. */
export const seekAudioPlayer = Effect.fn("designSystem.audioPlayer.seek")(
  (audio: HTMLAudioElement, time: number) =>
    Effect.try({
      try: () => {
        audio.currentTime = time;
      },
      catch: (cause) => operationError("seek", cause),
    })
);

/** Changes playback speed through the typed error channel. */
export const setAudioPlayerPlaybackRate = Effect.fn(
  "designSystem.audioPlayer.setPlaybackRate"
)((audio: HTMLAudioElement, rate: number) =>
  Effect.try({
    try: () => {
      audio.playbackRate = rate;
    },
    catch: (cause) => operationError("set-playback-rate", cause),
  })
);
