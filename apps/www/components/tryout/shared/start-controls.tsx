"use client";

import { Rocket01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import type { ComponentProps, ReactNode } from "react";

interface TryoutStartActionButtonProps
  extends Omit<ComponentProps<typeof Button>, "children"> {
  children: ReactNode;
  isPending: boolean;
}

/** Renders one shared start action button for tryout entry points. */
export function TryoutStartActionButton({
  children,
  isPending,
  ...props
}: TryoutStartActionButtonProps) {
  return (
    <Button {...props}>
      <Spinner icon={Rocket01Icon} isLoading={isPending} />
      {children}
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
          <TryoutStartActionButton
            disabled={isBlocked}
            isPending={isPending}
            onClick={onConfirmAction}
            type="button"
          >
            {confirmLabel}
          </TryoutStartActionButton>
        </div>
      }
      open={isOpen}
      setOpen={setOpenAction}
      title={title}
    />
  );
}
