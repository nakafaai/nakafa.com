"use client";

import type { GenericId } from "@confect/core";
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
import { SchoolHeader } from "@/components/tenant/header";

/**
 * The one header of the dashboard: the sidebar's trigger, the path from the exams through the
 * exam to the sitting's room, and at its end the token with the action that changes it, then
 * the action that closes the sitting. The page carries the token only for a proctor, and the
 * actions show only when the page lists them.
 */
export function SittingHeader({
  examId,
}: {
  readonly examId: GenericId.GenericId<"exams">;
}) {
  const t = useTranslations("Exams");
  const { value } = useSittingData();
  const mayProctor = useMayProctor();
  const [dialog, setDialog] = useState<"close" | "token" | null>(null);

  return (
    <SchoolHeader
      items={[
        { href: "/exams", label: t("title") },
        { href: `/exams/${examId}/edit`, label: value.sitting.examTitle },
        { label: value.sitting.room },
      ]}
      title={value.sitting.room}
    >
      {value.token === null ? null : (
        <span className="font-mono text-sm tabular-nums tracking-wider">
          {value.token}
        </span>
      )}
      {mayProctor ? (
        <>
          <Button
            onClick={() => setDialog("token")}
            type="button"
            variant="outline"
          >
            {t("change-token")}
          </Button>
          <Button
            onClick={() => setDialog("close")}
            type="button"
            variant="destructive"
          >
            {t("close-sitting")}
          </Button>
        </>
      ) : null}
      <ChangeTokenDialog
        onOpenChange={(open) => setDialog(open ? "token" : null)}
        open={dialog === "token"}
      />
      <CloseSittingDialog
        onOpenChange={(open) => setDialog(open ? "close" : null)}
        open={dialog === "close"}
      />
    </SchoolHeader>
  );
}
