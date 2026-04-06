"use client";

import { Rocket01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Spinner } from "@repo/design-system/components/ui/spinner";

/** Renders one shared start action button for tryout entry points. */
export function TryoutStartActionButton({
  className,
  isBlocked,
  isPending,
  label,
  onClickAction,
}: {
  className?: string;
  isBlocked: boolean;
  isPending: boolean;
  label: string;
  onClickAction: () => void;
}) {
  return (
    <Button className={className} disabled={isBlocked} onClick={onClickAction}>
      <Spinner icon={Rocket01Icon} isLoading={isPending} />
      {label}
    </Button>
  );
}

/** Renders one shared confirmation dialog for starting a tryout. */
export function TryoutStartConfirmDialog({
  cancelLabel,
  confirmLabel,
  description,
  isBlocked,
  isOpen,
  isPending,
  onConfirmAction,
  setOpenAction,
  title,
}: {
  cancelLabel: string;
  confirmLabel: string;
  description: string;
  isBlocked: boolean;
  isOpen: boolean;
  isPending: boolean;
  onConfirmAction: () => void;
  setOpenAction: (open: boolean) => void;
  title: string;
}) {
  return (
    <ResponsiveDialog
      description={description}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            onClick={() => setOpenAction(false)}
            type="button"
            variant="outline"
          >
            {cancelLabel}
          </Button>
          <Button disabled={isBlocked} onClick={onConfirmAction} type="button">
            <Spinner icon={Rocket01Icon} isLoading={isPending} />
            {confirmLabel}
          </Button>
        </div>
      }
      open={isOpen}
      setOpen={setOpenAction}
      title={title}
    />
  );
}
