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
import type { ReactNode } from "react";

type Props = {
  open: boolean;
  setOpen: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  styleClassName?: {
    dialog?: {
      header?: string;
      title?: string;
      description?: string;
      footer?: string;
      content?: string;
    };
    drawer?: {
      header?: string;
      title?: string;
      description?: string;
      footer?: string;
      content?: string;
    };
  };
};

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
            {description && (
              <DialogDescription
                className={styleClassName?.dialog?.description}
              >
                {description}
              </DialogDescription>
            )}
          </DialogHeader>
          {children}
          {footer && (
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
        <DrawerHeader className={styleClassName?.drawer?.header}>
          <DrawerTitle className={styleClassName?.drawer?.title}>
            {title}
          </DrawerTitle>
          {description && (
            <DrawerDescription className={styleClassName?.drawer?.description}>
              {description}
            </DrawerDescription>
          )}
        </DrawerHeader>
        <div
          className={cn(
            "flex-1 overflow-y-auto border-y p-4",
            !footer && "border-b-0"
          )}
        >
          {children}
        </div>
        {footer && (
          <DrawerFooter className={styleClassName?.drawer?.footer}>
            {footer}
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}
