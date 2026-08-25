"use client";
import { useCallbackRef, useDisclosure } from "@mantine/hooks";
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
import {
  type MouseEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { QuranInterpretationContext } from "@/components/shared/quran/interpretation/context";
import { reportClientException } from "@/lib/analytics/client";

interface Props {
  children: ReactNode;
  errorMessage: string;
  label: string;
  recoverSnapshot: () => Promise<void>;
  refreshingMessage: string;
  snapshotId: string;
  surahNumber: number;
}
/** Reads the exact verse identity selected by one tafsir button. */
function getVerseNumber(button: HTMLButtonElement) {
  const verseNumber = Number(button.dataset.quranInterpretationVerse);
  if (!Number.isSafeInteger(verseNumber) || verseNumber < 1) {
    return null;
  }
  return verseNumber;
}
/** Coordinates every verse tafsir request and drawer through one client controller. */
export function QuranInterpretationControls({
  children,
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
  const [pendingVerseNumber, setPendingVerseNumber] = useState<number | null>(
    null
  );
  const [isControllerActive, setControllerActive] = useState(false);
  const [isPending, startTransition] = useTransition();
  const requestSequence = useRef(0);
  const pendingRequestId = useRef<number | null>(null);
  const toastId = `quran-interpretation-${snapshotId}-${surahNumber}`;
  // Cached routes use React Activity, which runs layout cleanup while hidden.
  useLayoutEffect(
    () => () => {
      requestSequence.current += 1;
      pendingRequestId.current = null;
      setPendingVerseNumber(null);
      close();
      setSelectedInterpretation("");
      toast.dismiss(toastId);
    },
    [close, toastId]
  );
  const handleInterpretationClick = (event: MouseEvent<HTMLButtonElement>) => {
    const verseNumber = getVerseNumber(event.currentTarget);
    if (verseNumber === null) {
      return;
    }
    if (isPending || pendingRequestId.current !== null) {
      return;
    }
    requestSequence.current += 1;
    const requestId = requestSequence.current;
    pendingRequestId.current = requestId;
    setPendingVerseNumber(verseNumber);
    close();
    setSelectedInterpretation("");
    const program = Effect.tryPromise({
      catch: toQuranInterpretationRequestError,
      try: () =>
        convex.query(api.contentRelease.quran.interpretation, {
          expectedSnapshotId: snapshotId,
          appLocale: "id",
          surahNumber,
          verseNumber,
        }),
    }).pipe(
      Effect.flatMap((result) =>
        decodePublishedQuranInterpretation(result, {
          appLocale: "id",
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
      Effect.catch((error) => {
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
            Effect.andThen(
              Effect.tryPromise({
                catch: toQuranInterpretationRequestError,
                try: recoverSnapshot,
              }).pipe(
                Effect.catch((recoveryError) =>
                  Effect.sync(() => {
                    toast.error(errorMessage, {
                      id: toastId,
                      position: "bottom-center",
                    });
                  }).pipe(
                    Effect.andThen(
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
          Effect.andThen(
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
          if (pendingRequestId.current !== requestId) {
            return;
          }
          pendingRequestId.current = null;
          setPendingVerseNumber(null);
        })
      ),
      Effect.asVoid
    );
    startTransition(() => Effect.runPromise(program));
  };
  const selectInterpretation = useCallbackRef(handleInterpretationClick);
  // Activity defers cleanup updates until this route becomes visible again.
  // Keep this after useCallbackRef so triggers re-enable only after their
  // handler is live again.
  // https://react.dev/reference/react/Activity
  useEffect(() => {
    setControllerActive(true);

    return () => {
      setControllerActive(false);
    };
  }, []);
  const contextValue = {
    isActive: isControllerActive,
    pendingVerseNumber: isPending ? pendingVerseNumber : null,
    selectInterpretation,
  };
  return (
    <QuranInterpretationContext.Provider value={contextValue}>
      {children}
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
    </QuranInterpretationContext.Provider>
  );
}
