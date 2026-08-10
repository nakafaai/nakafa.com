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
import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { reportClientException } from "@/lib/analytics/client";

interface Props {
  errorMessage: string;
  label: string;
  recoverSnapshot: () => Promise<void>;
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

const setInterpretationButtonLoading = Effect.fn(
  "www.quran.setInterpretationButtonLoading"
)((button: HTMLButtonElement, isLoading: boolean) =>
  Effect.sync(() => {
    button.disabled = isLoading;
    button.toggleAttribute("data-loading", isLoading);

    if (isLoading) {
      button.setAttribute("aria-busy", "true");
      return;
    }

    button.removeAttribute("aria-busy");
  })
);

/** Handles all verse tafsir drawers through one hydrated client island. */
export function QuranInterpretationControls({
  errorMessage,
  label,
  recoverSnapshot,
  refreshingMessage,
  snapshotId,
  surahNumber,
}: Props) {
  const convex = useConvex();
  const [isOpen, { close, open, set }] = useDisclosure(false);
  const [selectedInterpretation, setSelectedInterpretation] = useState("");
  const [isPending, startTransition] = useTransition();
  const requestSequence = useRef(0);
  const pendingButton = useRef<HTMLButtonElement | null>(null);
  const pendingRequestId = useRef<number | null>(null);
  const toastId = `quran-interpretation-${snapshotId}-${surahNumber}`;

  // Cached routes use React Activity, which runs layout cleanup while hidden.
  useLayoutEffect(
    () => () => {
      requestSequence.current += 1;
      if (pendingButton.current) {
        Effect.runSync(
          setInterpretationButtonLoading(pendingButton.current, false)
        );
      }
      pendingButton.current = null;
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
    pendingButton.current = button;
    pendingRequestId.current = requestId;
    close();
    setSelectedInterpretation("");

    const program = setInterpretationButtonLoading(button, true).pipe(
      Effect.zipRight(
        Effect.tryPromise({
          catch: toQuranInterpretationRequestError,
          try: () =>
            convex.query(api.contentRelease.quran.interpretation, {
              expectedSnapshotId: snapshotId,
              locale: "id",
              surahNumber,
              verseNumber,
            }),
        })
      ),
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
      Effect.catchAll((error) => {
        if (requestSequence.current !== requestId) {
          return Effect.void;
        }

        if (isQuranSnapshotConflict(error)) {
          return Effect.sync(() =>
            toast.info(refreshingMessage, {
              id: toastId,
              position: "bottom-center",
            })
          ).pipe(
            Effect.zipRight(
              Effect.tryPromise({
                catch: toQuranInterpretationRequestError,
                try: recoverSnapshot,
              }).pipe(
                Effect.catchAll((recoveryError) =>
                  Effect.sync(() => {
                    toast.error(errorMessage, {
                      id: toastId,
                      position: "bottom-center",
                    });
                  }).pipe(
                    Effect.zipRight(
                      reportClientException(recoveryError, {
                        source: "quran-interpretation-recovery",
                        surahNumber,
                        verseNumber,
                      })
                    )
                  )
                )
              )
            )
          );
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
        setInterpretationButtonLoading(button, false).pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              if (pendingButton.current === button) {
                pendingButton.current = null;
              }
              if (pendingRequestId.current === requestId) {
                pendingRequestId.current = null;
              }
            })
          )
        )
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
