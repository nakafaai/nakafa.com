"use client";

import { useDisclosure, useWindowEvent } from "@mantine/hooks";
import { decodePublishedQuranInterpretation } from "@repo/backend/client/quran/interpretation";
import { api } from "@repo/backend/convex/_generated/api";
import {
  Drawer,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
} from "@repo/design-system/components/ui/drawer";
import { useConvex } from "convex/react";
import { Effect } from "effect";
import { useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { reportClientException } from "@/lib/analytics/client";

interface Props {
  errorMessage: string;
  label: string;
  snapshotId: string;
  surahNumber: number;
}

const INTERPRETATION_BUTTON_SELECTOR = "[data-quran-interpretation-verse]";

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

/** Reads the exact verse identity selected by one delegated button. */
function getVerseNumber(button: HTMLButtonElement) {
  const verseNumber = Number(button.dataset.quranInterpretationVerse);
  if (!Number.isSafeInteger(verseNumber) || verseNumber < 1) {
    return null;
  }

  return verseNumber;
}

/** Handles all verse tafsir drawers through one hydrated client island. */
export function QuranInterpretationControls({
  errorMessage,
  label,
  snapshotId,
  surahNumber,
}: Props) {
  const convex = useConvex();
  const [isOpen, { close, open, set }] = useDisclosure(false);
  const [selectedInterpretation, setSelectedInterpretation] = useState("");
  const requestSequence = useRef(0);
  const toastId = `quran-interpretation-${snapshotId}-${surahNumber}`;

  // Cached routes use React Activity, which runs layout cleanup while hidden.
  useLayoutEffect(
    () => () => {
      requestSequence.current += 1;
      close();
      setSelectedInterpretation("");
      toast.dismiss(toastId);
    },
    [close, toastId]
  );

  useWindowEvent("click", (event) => {
    const button = getInterpretationButton(event);
    if (!button) {
      return;
    }

    const verseNumber = getVerseNumber(button);
    if (verseNumber === null) {
      return;
    }

    requestSequence.current += 1;
    const requestId = requestSequence.current;
    const program = Effect.tryPromise(() =>
      convex.query(api.contentRelease.quran.interpretation, {
        expectedSnapshotId: snapshotId,
        locale: "id",
        surahNumber,
        verseNumber,
      })
    ).pipe(
      Effect.flatMap((result) =>
        decodePublishedQuranInterpretation(result, {
          locale: "id",
          snapshotId,
          surahNumber,
          verseNumber,
        })
      ),
      Effect.tap(({ interpretation }) =>
        Effect.sync(() => {
          if (requestSequence.current !== requestId) {
            return;
          }

          setSelectedInterpretation(interpretation);
          open();
        })
      ),
      Effect.catchAll((error) =>
        Effect.sync(() => {
          if (requestSequence.current === requestId) {
            toast.error(errorMessage, {
              id: toastId,
              position: "bottom-center",
            });
          }
        }).pipe(
          Effect.andThen(
            reportClientException(error, {
              source: "quran-interpretation",
              surahNumber,
              verseNumber,
            })
          )
        )
      )
    );

    Effect.runFork(program);
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
