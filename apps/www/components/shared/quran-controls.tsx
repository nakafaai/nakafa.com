"use client";

import { useDisclosure, useWindowEvent } from "@mantine/hooks";
import {
  Drawer,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
} from "@repo/design-system/components/ui/drawer";
import { useState } from "react";

import { useQuranAudioControls } from "./quran-audio-controls";

/** Localized labels used by the page-level Quran controls island. */
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

const INTERPRETATION_BUTTON_SELECTOR = "[data-quran-interpretation-index]";
const EMPTY_INTERPRETATIONS: string[] = [];

/** Finds a delegated tafsir button from a browser click event. */
function getInterpretationButton(event: MouseEvent) {
  const target = event.target;

  if (!(target instanceof Element)) {
    return null;
  }

  const button = target.closest(INTERPRETATION_BUTTON_SELECTOR);

  if (!(button instanceof HTMLButtonElement)) {
    return null;
  }

  return button;
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
  interpretations = EMPTY_INTERPRETATIONS,
  labels,
}: Props) {
  useQuranAudioControls({ audioSources, labels });

  const [
    isInterpretationOpen,
    { open: openInterpretationDrawer, set: setInterpretationOpen },
  ] = useDisclosure(false);
  const [selectedInterpretation, setSelectedInterpretation] = useState("");

  const openInterpretation = (button: HTMLButtonElement) => {
    const interpretation = getInterpretationText({
      button,
      interpretations,
    });

    if (!interpretation) {
      return;
    }

    setSelectedInterpretation(interpretation);
    openInterpretationDrawer();
  };

  useWindowEvent("click", (event) => {
    const interpretationButton = getInterpretationButton(event);

    if (!interpretationButton) {
      return;
    }

    openInterpretation(interpretationButton);
  });

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
