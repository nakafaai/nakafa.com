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
import { cn } from "cn";
import type { ComponentProps, ReactNode } from "react";

interface Props {
  children?: ReactNode;
  /** The one sentence under the title that says what the dialog does; every dialog has one. */
  description: ReactNode;
  /**
   * Where focus goes on close: `true` for the default, `false` to leave it to
   * the caller, or the element that a function returns.
   */
  finalFocus?: ComponentProps<typeof DialogContent>["finalFocus"];
  footer?: ReactNode;
  /** Runs after the open or close animation has finished. */
  onOpenChangeComplete?: (open: boolean) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  /** The width of the dialog on a wide screen: `wide` for content such as a diagram at its natural size. */
  size?: ComponentProps<typeof DialogContent>["size"];
  title: ReactNode;
}

export function ResponsiveDialog({
  open,
  setOpen,
  title,
  description,
  children,
  finalFocus,
  footer,
  onOpenChangeComplete,
  size = "default",
}: Props) {
  const isDesktop = useMediaQuery(TAILWIND_MEDIA_QUERIES.mdAndUp);

  if (isDesktop) {
    return (
      <Dialog
        onOpenChange={setOpen}
        onOpenChangeComplete={onOpenChangeComplete}
        open={open}
      >
        <DialogContent finalFocus={finalFocus} size={size}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {!!children && <DialogPanel>{children}</DialogPanel>}
          {!!footer && <DialogFooter>{footer}</DialogFooter>}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer
      onOpenChange={setOpen}
      onOpenChangeComplete={onOpenChangeComplete}
      open={open}
    >
      <DrawerPopup finalFocus={finalFocus} showBar>
        <DrawerHeader className={cn("border-b", !children && "border-b-0")}>
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <div className={cn("min-h-0 flex-1", !children && "hidden")}>
          <DrawerPanel>{children}</DrawerPanel>
        </div>
        {!!footer && <DrawerFooter>{footer}</DrawerFooter>}
      </DrawerPopup>
    </Drawer>
  );
}
