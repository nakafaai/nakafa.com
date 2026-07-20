"use client";

import { useWindowEvent } from "@mantine/hooks";
import { Effect } from "effect";
import { useEffectEvent, useLayoutEffect, useRef } from "react";

interface QuranAudioControlProps {
  audioSources: string[][];
  labels: {
    playAudio: string;
    stopAudio: string;
  };
}

type AudioButtonState = "idle" | "playing";

const AUDIO_BUTTON_SELECTOR = "[data-quran-audio-index]";
const AUDIO_LABEL_SELECTOR = "[data-quran-audio-label]";

/** Reads the fallback source list for one server-rendered verse button. */
function getAudioSources({
  audioSources,
  button,
}: {
  audioSources: string[][];
  button: HTMLButtonElement;
}) {
  const index = Number(button.dataset.quranAudioIndex);

  if (!Number.isInteger(index)) {
    return [];
  }

  return audioSources[index] ?? [];
}

/** Finds a delegated Quran audio button from a browser click event. */
function getAudioButton(event: MouseEvent) {
  const target = event.target;

  if (!(target instanceof Element)) {
    return null;
  }

  const button = target.closest(AUDIO_BUTTON_SELECTOR);

  if (!(button instanceof HTMLButtonElement)) {
    return null;
  }

  return button;
}

/** Updates the visible and screen-reader state for one audio button. */
function setAudioButtonState({
  button,
  label,
  state,
}: {
  button: HTMLButtonElement;
  label: string;
  state: AudioButtonState;
}) {
  button.dataset.state = state;
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-pressed", state === "playing" ? "true" : "false");

  const visibleLabel = button.querySelector(AUDIO_LABEL_SELECTOR);

  if (!visibleLabel) {
    return;
  }

  visibleLabel.textContent = label;
}

/** Watches one virtualized audio button and returns its browser cleanup. */
function observeElementRemoval(element: Element, onRemoval: () => void) {
  const observer = new MutationObserver(() => {
    if (element.isConnected) {
      return;
    }

    onRemoval();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  return () => observer.disconnect();
}

/**
 * Owns delegated Quran audio playback, fallback sources, and virtualized-button
 * cleanup for the page-level controls island.
 */
export function useQuranAudioControls({
  audioSources,
  labels,
}: QuranAudioControlProps) {
  const disconnectObserverRef = useRef<(() => void) | null>(null);
  const activeButtonRef = useRef<HTMLButtonElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const disconnectActiveObserver = () => {
    const disconnectObserver = disconnectObserverRef.current;

    if (!disconnectObserver) {
      return;
    }

    disconnectObserver();
    disconnectObserverRef.current = null;
  };

  const stopAudio = () => {
    disconnectActiveObserver();

    const audio = audioRef.current;

    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audio.onended = null;
      audio.onerror = null;
      audioRef.current = null;
    }

    const activeButton = activeButtonRef.current;

    if (!activeButton) {
      return;
    }

    setAudioButtonState({
      button: activeButton,
      label: labels.playAudio,
      state: "idle",
    });
    activeButtonRef.current = null;
  };

  const playAudio = (button: HTMLButtonElement) => {
    const sources = getAudioSources({ audioSources, button });

    if (sources.length === 0) {
      return;
    }

    if (activeButtonRef.current === button) {
      stopAudio();
      return;
    }

    stopAudio();

    const audio = new Audio();
    audio.preload = "none";
    audioRef.current = audio;
    activeButtonRef.current = button;

    setAudioButtonState({
      button,
      label: labels.stopAudio,
      state: "playing",
    });

    disconnectObserverRef.current = observeElementRemoval(button, stopAudio);

    let sourceIndex = 0;

    function stopThisAudio() {
      if (audioRef.current !== audio) {
        return;
      }

      stopAudio();
    }

    function playNextSource() {
      if (audioRef.current !== audio) {
        return;
      }

      const source = sources[sourceIndex];
      sourceIndex += 1;

      if (!source) {
        stopThisAudio();
        return;
      }

      let hasFailed = false;

      function handlePlaybackFailure() {
        if (audioRef.current !== audio) {
          return;
        }

        if (hasFailed) {
          return;
        }

        hasFailed = true;
        playNextSource();
      }

      audio.src = source;
      audio.onerror = handlePlaybackFailure;
      audio.onended = stopThisAudio;

      Effect.runFork(
        Effect.tryPromise({
          try: () => audio.play(),
          catch: (error) => error,
        }).pipe(Effect.catchAll(() => Effect.sync(handlePlaybackFailure)))
      );
    }

    playNextSource();
  };

  const cleanupAudio = useEffectEvent(stopAudio);

  useWindowEvent("click", (event) => {
    const button = getAudioButton(event);

    if (!button) {
      return;
    }

    playAudio(button);
  });

  useLayoutEffect(
    () => () => {
      cleanupAudio();
    },
    []
  );
}
