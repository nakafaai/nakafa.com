"use client";

import type { AudioPlayerApi } from "@repo/design-system/lib/audio-player/runtime";
import { createContext, use } from "react";

/** Playback API context written by AudioPlayerProvider. */
export const AudioPlayerContext = createContext<AudioPlayerApi | null>(null);

/** Current playback time context written by AudioPlayerProvider. */
export const AudioPlayerTimeContext = createContext<number | null>(null);

/** Reads the audio player API from the nearest AudioPlayerProvider. */
export function useAudioPlayer(): AudioPlayerApi {
  const api = use(AudioPlayerContext);
  if (!api) {
    throw new Error(
      "useAudioPlayer cannot be called outside of AudioPlayerProvider"
    );
  }
  return api;
}

/** Reads the current audio time from the nearest AudioPlayerProvider. */
export function useAudioPlayerTime() {
  const time = use(AudioPlayerTimeContext);
  if (time === null) {
    throw new Error(
      "useAudioPlayerTime cannot be called outside of AudioPlayerProvider"
    );
  }
  return time;
}
