"use client";

import type { Ref } from "@confect/core";
import { HttpClient } from "@confect/js";
import { useDisclosure, useMounted } from "@mantine/hooks";
import {
  decodePublishedQuranInterpretation,
  isQuranSnapshotConflict,
  type QuranInterpretationRequestError,
  toQuranInterpretationRequestError,
} from "@repo/backend/client/quran/interpretation";
import type { QuranPublicationError } from "@repo/backend/client/quran/publication";
import refs from "@repo/backend/confect/_generated/refs";
import {
  Drawer,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
} from "@repo/design-system/components/ui/drawer";
import { Effect } from "effect";
import {
  type MouseEvent,
  type ReactNode,
  useLayoutEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { QuranInterpretationContext } from "@/components/shared/quran/interpretation/context";
import { reportClientException } from "@/lib/analytics/client";
import { httpLayer } from "@/lib/convex/http";

interface Props {
  appLocale: Ref.Args<
    typeof refs.public.contentRelease.quran.tafsir
  >["appLocale"];
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
  appLocale,
  children,
  errorMessage,
  label,
  recoverSnapshot,
  refreshingMessage,
  snapshotId,
  surahNumber,
}: Props) {
  const [isOpen, { close, open, set }] = useDisclosure(false);
  const [selectedInterpretation, setSelectedInterpretation] = useState("");
  const [pendingVerseNumber, setPendingVerseNumber] = useOptimistic<
    number | null
  >(null);
  const isControllerActive = useMounted();
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
  const selectInterpretation = (event: MouseEvent<HTMLButtonElement>) => {
    const verseNumber = getVerseNumber(event.currentTarget);
    if (verseNumber === null) {
      return;
    }
    if (pendingRequestId.current !== null) {
      return;
    }
    requestSequence.current += 1;
    const requestId = requestSequence.current;
    pendingRequestId.current = requestId;
    close();
    setSelectedInterpretation("");
    const reportFailure = (
      error: QuranInterpretationRequestError | QuranPublicationError
    ) =>
      Effect.sync(() => {
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
    const handleFailure = (
      error: QuranInterpretationRequestError | QuranPublicationError
    ) => {
      if (requestSequence.current !== requestId) {
        return Effect.void;
      }
      if (!isQuranSnapshotConflict(error)) {
        return reportFailure(error);
      }
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
            Effect.catchTag(
              "QuranInterpretationRequestError",
              (recoveryError) =>
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
    };
    const program = Effect.flatMap(HttpClient.HttpClient, (client) =>
      client.query(refs.public.contentRelease.quran.tafsir, {
        expectedSnapshotId: snapshotId,
        appLocale,
        surahNumber,
        verseNumber,
      })
    ).pipe(
      Effect.provide(httpLayer()),
      Effect.mapError(toQuranInterpretationRequestError),
      Effect.flatMap((result) =>
        decodePublishedQuranInterpretation(result, {
          appLocale,
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
      Effect.catchTags({
        QuranInterpretationRequestError: handleFailure,
        QuranPublicationError: handleFailure,
      }),
      Effect.ensuring(
        Effect.sync(() => {
          if (pendingRequestId.current !== requestId) {
            return;
          }
          pendingRequestId.current = null;
        })
      ),
      Effect.asVoid
    );
    startTransition(async () => {
      setPendingVerseNumber(verseNumber);
      await Effect.runPromise(program);
    });
  };
  const contextValue = {
    isActive: isControllerActive,
    pendingVerseNumber: isPending ? pendingVerseNumber : null,
    selectInterpretation,
  };
  return (
    <QuranInterpretationContext value={contextValue}>
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
    </QuranInterpretationContext>
  );
}
