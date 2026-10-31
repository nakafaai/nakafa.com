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
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerPanel,
  DrawerTitle,
} from "@repo/design-system/components/ui/drawer";
import { TAILWIND_MEDIA_QUERIES } from "@repo/design-system/lib/breakpoints";
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
  // The screen's width is read while the dialog renders: read in an effect it is false at first, so a dialog that
  // opens as it mounts would paint the drawer, then the dialog, and remount its body. Its popup renders through a
  // portal only in the browser, so the server's markup holds none of it and the read cannot differ from it.
  const isDesktop = useMediaQuery(TAILWIND_MEDIA_QUERIES.mdAndUp, undefined, {
    getInitialValueInEffect: false,
  });
  // The body is there whenever the caller gives one, also while what it holds is empty, so a message that
  // appears inside it never adds the panel and its padding at the same time.
  const hasBody = children !== undefined;
  // A footer holds the dialog's own way out, Close or Cancel, so the corner's close button shows only on a
  // dialog without one, and no dialog offers two.
  const cornerClose = !footer;

  if (isDesktop) {
    return (
      <Dialog
        onOpenChange={setOpen}
        onOpenChangeComplete={onOpenChangeComplete}
        open={open}
      >
        <DialogContent
          finalFocus={finalFocus}
          showCloseButton={cornerClose}
          size={size}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {hasBody ? <DialogPanel>{children}</DialogPanel> : null}
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
      showSwipeHandle
    >
      <DrawerContent finalFocus={finalFocus}>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        {hasBody ? <DrawerPanel>{children}</DrawerPanel> : null}
        {!!footer && <DrawerFooter>{footer}</DrawerFooter>}
      </DrawerContent>
    </Drawer>
  );
}
