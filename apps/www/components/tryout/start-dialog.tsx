"use client";

import { useTranslations } from "next-intl";
import { useTryoutSet } from "@/components/tryout/providers/set-state";
import { TryoutStartConfirmDialog } from "@/components/tryout/start-controls";

/** Renders the confirmation dialog for starting or restarting one tryout. */
export function TryoutStartDialog() {
  const tTryouts = useTranslations("Tryouts");
  const confirmStartAction = useTryoutSet(
    (state) => state.actions.confirmStartAction
  );
  const hasFinishedAttempt = useTryoutSet(
    (state) => state.state.hasFinishedAttempt
  );
  const isActionPending = useTryoutSet((state) => state.meta.isActionPending);
  const isDialogOpen = useTryoutSet((state) => state.meta.isDialogOpen);
  const isStartBlocked = useTryoutSet((state) => state.meta.isStartBlocked);
  const setDialogOpenAction = useTryoutSet(
    (state) => state.actions.setDialogOpenAction
  );

  return (
    <TryoutStartConfirmDialog
      cancelLabel={tTryouts("cancel-cta")}
      confirmLabel={
        hasFinishedAttempt ? tTryouts("restart-cta") : tTryouts("start-cta")
      }
      description={
        hasFinishedAttempt
          ? tTryouts("restart-dialog-description")
          : tTryouts("start-dialog-description")
      }
      isBlocked={isStartBlocked}
      isOpen={isDialogOpen}
      isPending={isActionPending}
      onConfirmAction={confirmStartAction}
      setOpenAction={setDialogOpenAction}
      title={
        hasFinishedAttempt
          ? tTryouts("restart-dialog-title")
          : tTryouts("start-dialog-title")
      }
    />
  );
}
