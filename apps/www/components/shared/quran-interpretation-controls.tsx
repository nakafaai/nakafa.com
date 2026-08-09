"use client";

import { useDisclosure, useWindowEvent } from "@mantine/hooks";
import {
  decodePublishedQuranInterpretation,
  isQuranSnapshotConflict,
  toQuranInterpretationRequestError,
} from "@repo/backend/client/quran/interpretation";
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
import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { reportClientException } from "@/lib/analytics/client";

interface Props {
  errorMessage: string;
  label: string;
  loadingMessage: string;
  refreshingMessage: string;
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
  loadingMessage,
  refreshingMessage,
  snapshotId,
  surahNumber,
}: Props) {
  const convex = useConvex();
  const router = useRouter();
  const [isOpen, { close, open, set }] = useDisclosure(false);
  const [selectedInterpretation, setSelectedInterpretation] = useState("");
  const [isPending, startTransition] = useTransition();
  const requestSequence = useRef(0);
  const pendingRequestId = useRef<number | null>(null);
  const toastId = `quran-interpretation-${snapshotId}-${surahNumber}`;

  // Cached routes use React Activity, which runs layout cleanup while hidden.
  useLayoutEffect(
    () => () => {
      requestSequence.current += 1;
      pendingRequestId.current = null;
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

    if (isPending || pendingRequestId.current !== null) {
      return;
    }

    requestSequence.current += 1;
    const requestId = requestSequence.current;
    pendingRequestId.current = requestId;
    close();
    setSelectedInterpretation("");
    toast.loading(loadingMessage, {
      id: toastId,
      position: "bottom-center",
    });

    const program = Effect.tryPromise({
      catch: toQuranInterpretationRequestError,
      try: () =>
        convex.query(api.contentRelease.quran.interpretation, {
          expectedSnapshotId: snapshotId,
          locale: "id",
          surahNumber,
          verseNumber,
        }),
    }).pipe(
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

          toast.dismiss(toastId);
          setSelectedInterpretation(interpretation);
          open();
        })
      ),
      Effect.catchAll((error) => {
        if (requestSequence.current !== requestId) {
          return Effect.void;
        }

        if (isQuranSnapshotConflict(error)) {
          return Effect.sync(() => {
            toast.info(refreshingMessage, {
              id: toastId,
              position: "bottom-center",
            });
            router.refresh();
          });
        }

        return Effect.sync(() => {
          toast.error(errorMessage, {
            id: toastId,
            position: "bottom-center",
          });
        }).pipe(
          Effect.zipRight(
            reportClientException(error, {
              source: "quran-interpretation",
              surahNumber,
              verseNumber,
            })
          )
        );
      }),
      Effect.ensuring(
        Effect.sync(() => {
          if (pendingRequestId.current === requestId) {
            pendingRequestId.current = null;
          }
        })
      ),
      Effect.asVoid
    );

    startTransition(() => Effect.runPromise(program));
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
