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

interface Props {
  interpretations: readonly string[];
  label: string;
}

const INTERPRETATION_BUTTON_SELECTOR = "[data-quran-interpretation-index]";

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

/** Reads the tafsir text selected by one delegated button. */
function getInterpretationText(
  button: HTMLButtonElement,
  interpretations: readonly string[]
) {
  const index = Number(button.dataset.quranInterpretationIndex);
  if (!Number.isInteger(index)) {
    return null;
  }

  return interpretations[index] ?? null;
}

/** Handles all verse tafsir drawers through one hydrated client island. */
export function QuranInterpretationControls({ interpretations, label }: Props) {
  const [isOpen, { open, set }] = useDisclosure(false);
  const [selectedInterpretation, setSelectedInterpretation] = useState("");

  useWindowEvent("click", (event) => {
    const button = getInterpretationButton(event);
    if (!button) {
      return;
    }

    const interpretation = getInterpretationText(button, interpretations);
    if (!interpretation) {
      return;
    }

    setSelectedInterpretation(interpretation);
    open();
  });

  return (
    <Drawer onOpenChange={set} open={isOpen}>
      <DrawerPopup className="mx-auto sm:max-w-3xl" showBar>
        <DrawerHeader className="border-b">
          <DrawerTitle className="text-center">{label}</DrawerTitle>
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
