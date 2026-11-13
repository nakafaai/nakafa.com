import {
  Drawer,
  DrawerContent,
} from "@repo/design-system/components/ui/drawer";
import { monospace } from "@repo/design-system/lib/monospace";
import { cn } from "cn";
import { type ReactNode, useRef } from "react";
import { useTranslations } from "use-intl";
import { usePlayer } from "@/components/player/provider";
import { PaneBody, PaneFooter, PaneHeader } from "@/components/shared/pane";
import { PaneModeContext } from "@/components/shared/panes/mode";

/**
 * The navigator below the large breakpoint: a drawer that the footer opens, with
 * the numbers and their legend in its body. It opens on the current number.
 * Picking a number closes the drawer first, and the question is revealed once
 * the drawer has finished closing, because the page cannot scroll while the
 * drawer holds it. A finished paper names the drawer for its result and closes
 * it on a footer, as its pane does. It draws a pane's header, body and footer,
 * as every phone sheet of a page's panes does.
 */
export function PlayerSheet({
  children,
  description,
  footer,
  title,
}: {
  children: ReactNode;
  /** What the drawer is for, the navigator's unless the paper says otherwise. */
  description?: string;
  /** What the drawer says and offers under its body, such as a result's legend and its one action. */
  footer?: ReactNode;
  /** The drawer's name, the navigator's unless the paper names it otherwise. */
  title?: string;
}) {
  const t = useTranslations("Player");
  const overlay = usePlayer((state) => state.overlay);
  // A question chosen here takes the focus, so the drawer never hands it back to where it opened.
  const landed = usePlayer((state) => state.landed);
  const open = usePlayer((state) => state.open);
  const close = usePlayer((state) => state.close);
  const settle = usePlayer((state) => state.settle);
  const body = useRef<HTMLDivElement>(null);

  return (
    <Drawer
      onOpenChange={(next) => (next ? open("navigator") : close())}
      onOpenChangeComplete={(next) => {
        if (!next) {
          settle();
        }
      }}
      open={overlay === "navigator"}
    >
      <DrawerContent
        finalFocus={!landed}
        initialFocus={() =>
          body.current?.querySelector<HTMLElement>('[aria-current="step"]') ??
          true
        }
      >
        <PaneModeContext value={{ close, place: "sheet" }}>
          <PaneHeader
            description={description ?? t("navigator-description")}
            title={title ?? t("navigator")}
          />
          <PaneBody>
            <div className={cn(monospace, "grid gap-4")} ref={body}>
              {children}
            </div>
          </PaneBody>
          {footer === undefined ? null : <PaneFooter>{footer}</PaneFooter>}
        </PaneModeContext>
      </DrawerContent>
    </Drawer>
  );
}
