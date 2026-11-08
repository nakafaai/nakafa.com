import { useMediaQuery } from "@mantine/hooks";
import { Button } from "@repo/design-system/components/ui/button";
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
import { OptionIcon } from "@repo/design-system/components/ui/huge-icons";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@repo/design-system/components/ui/item";
import { TAILWIND_MEDIA_QUERIES } from "@repo/design-system/lib/breakpoints";
import { pressMainAction } from "@repo/design-system/lib/dialog";
import {
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
  useRef,
} from "react";
import { useTranslations } from "use-intl";

interface Props {
  /**
   * The footer's action, beside the Cancel the dialog draws itself. A dialog that only shows something has none,
   * and its footer offers Close.
   */
  action?: ReactNode;
  /** The body: what the action does or takes away, or the fields it asks for. Every dialog has one. */
  children: ReactNode;
  /** The one sentence under the title that says what the dialog does; every dialog has one. */
  description: ReactNode;
  /**
   * Where focus goes on close: `true` for the default, `false` to leave it to
   * the caller, or the element that a function returns.
   */
  finalFocus?: ComponentProps<typeof DialogContent>["finalFocus"];
  /** Runs after the open or close animation has finished. */
  onOpenChangeComplete?: (open: boolean) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  /** The width of the dialog on a wide screen: `wide` for content such as a diagram at its natural size. */
  size?: ComponentProps<typeof DialogContent>["size"];
  title: ReactNode;
}

/**
 * A dialog on a wide screen and a drawer on a phone, with one anatomy on both, as shadcn's dialog and alert dialog
 * have it: a header with the title and its sentence; a body, which every dialog has; and a footer with Cancel beside
 * the action, or Close alone on a dialog that only shows something. The dialog shows its close in the top right
 * corner; the drawer closes as an iPhone sheet does, by its handle, a swipe or a press outside, so it draws no
 * close button. The dialog draws its header, its footer's way out and its close itself, so no dialog can leave
 * one out.
 */
export function ResponsiveDialog({
  action,
  open,
  setOpen,
  title,
  description,
  children,
  finalFocus,
  onOpenChangeComplete,
  size = "default",
}: Props) {
  // The screen's width is read while the dialog renders: read in an effect it is false at first, so a dialog that
  // opens as it mounts would paint the drawer, then the dialog, and remount its body. Its popup renders through a
  // portal only in the browser, so the server's markup holds none of it and the read cannot differ from it.
  const isDesktop = useMediaQuery(TAILWIND_MEDIA_QUERIES.mdAndUp, undefined, {
    getInitialValueInEffect: false,
  });
  const opened = useRef(false);
  const footerPart = useRef<HTMLDivElement>(null);
  const pressMain = (event: KeyboardEvent<HTMLDivElement>) =>
    pressMainAction(event, footerPart.current);

  // A press on the backdrop before the dialog has finished opening is the second press of the double press
  // that opened it, so the dialog stays.
  const change = (
    next: boolean,
    details: { readonly cancel: () => void; readonly reason: string }
  ) => {
    if (details.reason === "outside-press" && !opened.current) {
      details.cancel();
      return;
    }
    setOpen(next);
  };
  const complete = (next: boolean) => {
    opened.current = next;
    onOpenChangeComplete?.(next);
  };

  if (isDesktop) {
    return (
      <Dialog onOpenChange={change} onOpenChangeComplete={complete} open={open}>
        <DialogContent finalFocus={finalFocus} size={size}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogPanel onKeyDown={pressMain}>{children}</DialogPanel>
          <DialogFooter ref={footerPart}>
            <ResponsiveDialogCancel action={action} setOpen={setOpen} />
            {action}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer onOpenChange={change} onOpenChangeComplete={complete} open={open}>
      <DrawerContent finalFocus={finalFocus}>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <DrawerPanel onKeyDown={pressMain}>{children}</DrawerPanel>
        <DrawerFooter ref={footerPart}>
          <ResponsiveDialogCancel action={action} setOpen={setOpen} />
          {action}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

/**
 * The footer's way out, the first of its buttons: Cancel beside an action, or Close on a dialog that only shows
 * something. The action stays the footer's last button, the one an Enter in a field presses.
 */
function ResponsiveDialogCancel({
  action,
  setOpen,
}: {
  action: ReactNode;
  setOpen: (open: boolean) => void;
}) {
  const t = useTranslations("Common");

  return (
    <Button onClick={() => setOpen(false)} type="button" variant="outline">
      {t(action === undefined ? "close" : "cancel")}
    </Button>
  );
}

/**
 * What a dialog's action is about, the body of a confirm: the icon of its kind beside its name, and a second line
 * when one name is not enough, so the reader sees what the action changes or takes away before pressing it.
 */
export function ResponsiveDialogSubject({
  children,
  description,
  icon,
}: {
  children: ReactNode;
  description?: ReactNode;
  icon: ComponentProps<typeof OptionIcon>["icon"];
}) {
  return (
    <Item size="sm" variant="outline">
      <ItemMedia variant="icon">
        <OptionIcon icon={icon} />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="line-clamp-3 wrap-anywhere" dir="auto">
          {children}
        </ItemTitle>
        {description === undefined ? null : (
          <ItemDescription className="line-clamp-2">
            {description}
          </ItemDescription>
        )}
      </ItemContent>
    </Item>
  );
}
