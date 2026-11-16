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
import { OptionIcon } from "@repo/design-system/components/ui/huge-icons";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@repo/design-system/components/ui/item";
import { TAILWIND_MEDIA_QUERIES } from "@repo/design-system/lib/breakpoints";
import { pressMainAction } from "@repo/design-system/lib/dialog";
import { cva } from "class-variance-authority";
import {
  type ComponentProps,
  createContext,
  type KeyboardEvent,
  type ReactNode,
  use,
  useRef,
} from "react";

interface Props {
  /**
   * The footer's actions, the only buttons it holds: the close in the corner, a swipe or a press outside already
   * leave, so no footer repeats them with Cancel or Close. A dialog that only shows something has none, and no footer.
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
  /**
   * The size of the dialog: `wide` for a canvas such as a diagram, which takes most of a wide screen's width and
   * height and fills a body that does not scroll, so what it holds is the one thing that scrolls.
   */
  size?: ComponentProps<typeof DialogContent>["size"];
  title: ReactNode;
}

/**
 * A dialog on a wide screen and a drawer on a phone, with one anatomy on both, as shadcn's dialog and alert dialog
 * have it: a header with the title and its sentence; a body, which every dialog has; and a footer with the caller's
 * actions alone, which a dialog that only shows something leaves out. The dialog shows its close in the top right
 * corner; the drawer closes as an iPhone sheet does, by its handle, a swipe or a press outside, so it draws no close
 * button. That close is the one way out, so no footer repeats it with Cancel or Close. The dialog draws its header
 * and its close itself, so no dialog can leave one out.
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
          <DialogPanel fill={size === "wide"} onKeyDown={pressMain}>
            {children}
          </DialogPanel>
          {action === undefined || action === null ? null : (
            <DialogFooter ref={footerPart}>{action}</DialogFooter>
          )}
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
        <DrawerPanel fill={size === "wide"} onKeyDown={pressMain}>
          {children}
        </DrawerPanel>
        {action === undefined || action === null ? null : (
          <DrawerFooter ref={footerPart}>{action}</DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}

/** Whether a subject stands in a dialog's list of subjects (`ResponsiveDialogSubjects`). */
const SubjectsContext = createContext(false);

/** A subject alone keeps its own outline; in a list it is one row of the list's card, split from the next by a line. */
const dialogSubjectVariants = cva("", {
  variants: {
    listed: {
      false: "",
      true: "rounded-none border-x-0 border-t-0 last:border-b-0",
    },
  },
});

/**
 * Several subjects of one dialog as one card: rows joined by a line and no gap, as a button group joins its
 * segments, with the group's radius and shadow, so the dialog reads them as one list rather than separate boxes.
 */
export function ResponsiveDialogSubjects({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <SubjectsContext value={true}>
      <ItemGroup
        className="gap-0 overflow-hidden rounded-md border shadow-xs has-data-[size=sm]:gap-0"
        data-slot="dialog-subjects"
      >
        {children}
      </ItemGroup>
    </SubjectsContext>
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
  const listed = use(SubjectsContext);

  return (
    <Item
      className={dialogSubjectVariants({ listed })}
      render={listed ? <li /> : undefined}
      size="sm"
      variant="outline"
    >
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
