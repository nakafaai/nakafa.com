"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import type { ComponentProps } from "react";
import { useTranslations } from "use-intl";

/**
 * Asks the learner to confirm that a memory goes. Only the confirmation reaches
 * `onConfirm`, which removes the memory at once; the dialog only closes itself
 * when the learner cancels or confirms. It is the one confirm pattern of the
 * app's deletions: a dialog on desktop and a drawer on a phone.
 */
export function MemoryDeleteDialog({
  finalFocus,
  onConfirm,
  onOpenChange,
  open,
}: {
  finalFocus?: ComponentProps<typeof ResponsiveDialog>["finalFocus"];
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const t = useTranslations("Memory");
  const common = useTranslations("Common");
  return (
    <ResponsiveDialog
      description={t("delete-description")}
      finalFocus={finalFocus}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            {common("cancel")}
          </Button>
          <Button onClick={onConfirm} variant="destructive">
            {t("delete")}
          </Button>
        </>
      }
      open={open}
      setOpen={onOpenChange}
      title={t("delete-title")}
    />
  );
}
