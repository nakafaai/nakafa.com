"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  useMayProctor,
  useSittingData,
} from "@/components/exams/sitting/context";
import {
  ChangeTokenDialog,
  CloseSittingDialog,
} from "@/components/exams/sitting/dialogs";

/**
 * The one-row header of the dashboard: the exam and the room on the left, the token in the middle
 * with the action that changes it, and the action that closes the sitting on the right. The page
 * carries the token only for a proctor, and the actions show only when the page lists them.
 */
export function SittingHeader() {
  const t = useTranslations("Exams");
  const { value } = useSittingData();
  const mayProctor = useMayProctor();
  const [dialog, setDialog] = useState<"close" | "token" | null>(null);

  return (
    <header className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b pb-3">
      <div className="min-w-0">
        <p className="truncate font-medium text-sm">
          {value.sitting.examTitle}
        </p>
        <p className="truncate text-muted-foreground text-sm">
          {value.sitting.room}
        </p>
      </div>
      <div className="flex items-center justify-center gap-2">
        {value.token === null ? null : (
          <span className="font-mono text-sm tabular-nums tracking-wider">
            {value.token}
          </span>
        )}
        {mayProctor ? (
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
        {mayProctor ? (
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
