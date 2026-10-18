"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  useSittingData,
  useSittingStore,
} from "@/components/exams/sitting/context";
import {
  ChangeTokenDialog,
  CloseSittingDialog,
} from "@/components/exams/sitting/dialogs";

/**
 * The one-row header of the dashboard: the room on the left, the token of the sitting in
 * the middle with the action that changes it, and the action that closes the sitting on the
 * right. A viewer who may only view the dashboard sees the room alone.
 */
export function SittingHeader() {
  const t = useTranslations("Exams");
  const { canProctor, value } = useSittingData();
  const token = useSittingStore((state) => state.token);
  const [dialog, setDialog] = useState<"close" | "token" | null>(null);

  return (
    <header className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b pb-3">
      <p className="min-w-0 truncate font-medium text-sm">
        {value.sitting.room}
      </p>
      <div className="flex items-center justify-center gap-2">
        {canProctor && token !== null ? (
          <span className="font-mono text-sm tabular-nums tracking-wider">
            {token}
          </span>
        ) : null}
        {canProctor ? (
          <Button
            onClick={() => setDialog("token")}
            size="sm"
            type="button"
            variant="outline"
          >
            {t("change-token")}
          </Button>
        ) : null}
      </div>
      <div className="flex justify-end">
        {canProctor ? (
          <Button
            onClick={() => setDialog("close")}
            size="sm"
            type="button"
            variant="destructive"
          >
            {t("close-sitting")}
          </Button>
        ) : null}
      </div>
      <ChangeTokenDialog
        onOpenChange={(open) => setDialog(open ? "token" : null)}
        open={dialog === "token"}
      />
      <CloseSittingDialog
        onOpenChange={(open) => setDialog(open ? "close" : null)}
        open={dialog === "close"}
      />
    </header>
  );
}
