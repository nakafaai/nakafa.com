import { useMediaQuery } from "@mantine/hooks";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import {
  Drawer,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
} from "@repo/design-system/components/ui/drawer";
import { TAILWIND_MEDIA_QUERIES } from "@repo/design-system/lib/breakpoints";
import { cn } from "@repo/design-system/lib/utils";
import type { ReactNode } from "react";

interface Props {
  children?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  footerVariant?: "bare" | "default";
  open: boolean;
  setOpen: (open: boolean) => void;
  title: ReactNode;
}

export function ResponsiveDialog({
  open,
  setOpen,
  title,
  description,
  children,
  footer,
  footerVariant = "default",
}: Props) {
  const isDesktop = useMediaQuery(TAILWIND_MEDIA_QUERIES.mdAndUp);

  if (isDesktop) {
    return (
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {!!description && (
              <DialogDescription>{description}</DialogDescription>
            )}
          </DialogHeader>
          {!!children && <DialogPanel>{children}</DialogPanel>}
          {!!footer && (
            <DialogFooter variant={footerVariant}>{footer}</DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer onOpenChange={setOpen} open={open}>
      <DrawerPopup showBar>
        <DrawerHeader className={cn("border-b", !children && "border-b-0")}>
          <DrawerTitle>{title}</DrawerTitle>
          {!!description && (
            <DrawerDescription>{description}</DrawerDescription>
          )}
        </DrawerHeader>
        <div className={cn("min-h-0 flex-1", !children && "hidden")}>
          <DrawerPanel>{children}</DrawerPanel>
        </div>
        {!!footer && (
          <DrawerFooter variant={footerVariant}>{footer}</DrawerFooter>
        )}
      </DrawerPopup>
    </Drawer>
  );
}
