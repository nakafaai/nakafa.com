"use client";

import {
  Drawer,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
} from "@repo/design-system/components/ui/drawer";
import { useCallback, useEffect, useRef, useState } from "react";

export interface QuranControlLabels {
  interpretation: string;
  playAudio: string;
  stopAudio: string;
}

interface Props {
  audioSources: string[][];
  interpretations?: string[];
  labels: QuranControlLabels;
}

type AudioButtonState = "idle" | "playing";

const AUDIO_BUTTON_SELECTOR = "[data-quran-audio-index]";
const AUDIO_LABEL_SELECTOR = "[data-quran-audio-label]";
const INTERPRETATION_BUTTON_SELECTOR = "[data-quran-interpretation-index]";

/**
 * Reads the fallback audio source list for one server-rendered verse button.
 */
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

/**
 * Finds a delegated Quran control button from a browser click event.
 */
function getDelegatedButton(event: MouseEvent, selector: string) {
  const target = event.target;

  if (!(target instanceof Element)) {
    return null;
  }

  const button = target.closest(selector);

  if (!(button instanceof HTMLButtonElement)) {
    return null;
  }

  return button;
}

/**
 * Updates the visible and screen-reader state for one audio button.
 */
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

/**
 * Returns the tafsir text pointed to by one delegated tafsir button.
 */
function getInterpretationText({
  button,
  interpretations,
}: {
  button: HTMLButtonElement;
  interpretations: string[];
}) {
  const index = Number(button.dataset.quranInterpretationIndex);

  if (!Number.isInteger(index)) {
    return "";
  }

  return interpretations[index] ?? "";
}

/**
 * Handles all Quran verse controls through one hydrated client island.
 */
export function QuranPageControls({
  audioSources,
  interpretations = [],
  labels,
}: Props) {
  const activeAudioObserverRef = useRef<MutationObserver | null>(null);
  const activeAudioButtonRef = useRef<HTMLButtonElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isInterpretationOpen, setInterpretationOpen] = useState(false);
  const [selectedInterpretation, setSelectedInterpretation] = useState("");

  /**
   * Stops watching the active verse button after playback ends or changes.
   */
  const disconnectActiveAudioObserver = useCallback(() => {
    const observer = activeAudioObserverRef.current;

    if (!observer) {
      return;
    }

    observer.disconnect();
    activeAudioObserverRef.current = null;
  }, []);

  const stopAudio = useCallback(() => {
    disconnectActiveAudioObserver();

    const audio = audioRef.current;

    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audio.onended = null;
      audio.onerror = null;
      audioRef.current = null;
    }

    const activeAudioButton = activeAudioButtonRef.current;

    if (!activeAudioButton) {
      return;
    }

    setAudioButtonState({
      button: activeAudioButton,
      label: labels.playAudio,
      state: "idle",
    });
    activeAudioButtonRef.current = null;
  }, [disconnectActiveAudioObserver, labels.playAudio]);

  const playAudio = useCallback(
    (button: HTMLButtonElement) => {
      const sources = getAudioSources({ audioSources, button });

      if (sources.length === 0) {
        return;
      }

      if (activeAudioButtonRef.current === button) {
        stopAudio();
        return;
      }

      stopAudio();

      const audio = new Audio();
      audio.preload = "none";
      audioRef.current = audio;
      activeAudioButtonRef.current = button;

      setAudioButtonState({
        button,
        label: labels.stopAudio,
        state: "playing",
      });

      const activeAudioObserver = new MutationObserver(() => {
        if (button.isConnected) {
          return;
        }

        stopAudio();
      });

      activeAudioObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
      activeAudioObserverRef.current = activeAudioObserver;

      let sourceIndex = 0;

      /**
       * Stops this playback request only while it is still the active request.
       */
      function stopThisAudio() {
        if (audioRef.current !== audio) {
          return;
        }

        stopAudio();
      }

      /**
       * Attempts the next available recitation source for this verse.
       */
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

        /**
         * Moves to the next source once for a failed playback attempt.
         */
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

        audio.play().catch(handlePlaybackFailure);
      }

      playNextSource();
    },
    [audioSources, labels.stopAudio, stopAudio]
  );

  const openInterpretation = useCallback(
    (button: HTMLButtonElement) => {
      const interpretation = getInterpretationText({
        button,
        interpretations,
      });

      if (!interpretation) {
        return;
      }

      setSelectedInterpretation(interpretation);
      setInterpretationOpen(true);
    },
    [interpretations]
  );

  useEffect(() => {
    /**
     * Routes verse button clicks to the single Quran page controller.
     */
    function handleDocumentClick(event: MouseEvent) {
      const audioButton = getDelegatedButton(event, AUDIO_BUTTON_SELECTOR);

      if (audioButton) {
        playAudio(audioButton);
        return;
      }

      const interpretationButton = getDelegatedButton(
        event,
        INTERPRETATION_BUTTON_SELECTOR
      );

      if (!interpretationButton) {
        return;
      }

      openInterpretation(interpretationButton);
    }

    document.addEventListener("click", handleDocumentClick);

    return () => {
      document.removeEventListener("click", handleDocumentClick);
    };
  }, [openInterpretation, playAudio]);

  useEffect(() => {
    /**
     * Stops Quran audio when the page controller leaves the tree.
     */
    function cleanupAudio() {
      stopAudio();
    }

    return cleanupAudio;
  }, [stopAudio]);

  return (
    <Drawer onOpenChange={setInterpretationOpen} open={isInterpretationOpen}>
      <DrawerPopup className="mx-auto sm:max-w-3xl" showBar>
        <DrawerHeader className="border-b">
          <DrawerTitle className="text-center">
            {labels.interpretation}
          </DrawerTitle>
        </DrawerHeader>

        <DrawerPanel className="p-4">
          <div className="rounded-md border bg-accent p-4">
            <p className="text-pretty text-accent-foreground leading-relaxed">
              {selectedInterpretation}
            </p>
          </div>
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  );
}
