import { useMediaQuery } from "@mantine/hooks";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@repo/design-system/components/ui/drawer";
import { cn } from "@repo/design-system/lib/utils";
import type { ComponentProps, ReactNode } from "react";

interface Props {
  children?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  open: boolean;
  setOpen: (open: boolean) => void;
  styleClassName?: {
    dialog?: {
      header?: ComponentProps<typeof DialogHeader>["className"];
      title?: ComponentProps<typeof DialogTitle>["className"];
      description?: ComponentProps<typeof DialogDescription>["className"];
      footer?: ComponentProps<typeof DialogFooter>["className"];
      content?: ComponentProps<typeof DialogContent>["className"];
    };
    drawer?: {
      header?: ComponentProps<typeof DrawerHeader>["className"];
      title?: ComponentProps<typeof DrawerTitle>["className"];
      description?: ComponentProps<typeof DrawerDescription>["className"];
      footer?: ComponentProps<typeof DrawerFooter>["className"];
      content?: ComponentProps<typeof DrawerContent>["className"];
    };
  };
  title: ReactNode;
}

export function ResponsiveDialog({
  open,
  setOpen,
  title,
  description,
  children,
  footer,
  styleClassName,
}: Props) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className={styleClassName?.dialog?.content}>
          <DialogHeader className={styleClassName?.dialog?.header}>
            <DialogTitle className={styleClassName?.dialog?.title}>
              {title}
            </DialogTitle>
            {!!description && (
              <DialogDescription
                className={styleClassName?.dialog?.description}
              >
                {description}
              </DialogDescription>
            )}
          </DialogHeader>
          {children}
          {!!footer && (
            <DialogFooter className={styleClassName?.dialog?.footer}>
              {footer}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer onOpenChange={setOpen} open={open}>
      <DrawerContent className={styleClassName?.drawer?.content}>
        <DrawerHeader
          className={cn(
            "border-b",
            !children && "border-b-0",
            styleClassName?.drawer?.header
          )}
        >
          <DrawerTitle className={styleClassName?.drawer?.title}>
            {title}
          </DrawerTitle>
          {!!description && (
            <DrawerDescription className={styleClassName?.drawer?.description}>
              {description}
            </DrawerDescription>
          )}
        </DrawerHeader>
        <div
          className={cn("flex-1 overflow-y-auto p-4", !children && "hidden")}
        >
          {children}
        </div>
        {!!footer && (
          <DrawerFooter className={styleClassName?.drawer?.footer}>
            {footer}
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}
