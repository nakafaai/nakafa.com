"use client";

import { Delete02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useTranslations } from "next-intl";

/** Render the shared destructive-action confirmation dialog for class resources. */
export function SchoolClassesDeleteDialog({
  description,
  isPending,
  onConfirmAction,
  open,
  setOpenAction,
  title,
}: {
  description: string;
  isPending: boolean;
  onConfirmAction: () => void;
  open: boolean;
  setOpenAction: (open: boolean) => void;
  title: string;
}) {
  const t = useTranslations("Common");

  return (
    <ResponsiveDialog
      description={description}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            disabled={isPending}
            onClick={() => setOpenAction(false)}
            type="button"
            variant="outline"
          >
            {t("cancel")}
          </Button>
          <Button
            disabled={isPending}
            onClick={onConfirmAction}
            type="button"
            variant="destructive"
          >
            <Spinner icon={Delete02Icon} isLoading={isPending} />
            {t("delete")}
          </Button>
        </div>
      }
      open={open}
      setOpen={setOpenAction}
      title={title}
    />
  );
}
