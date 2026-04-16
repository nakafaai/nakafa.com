"use client";

import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { useMediaQuery } from "@mantine/hooks";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import type { ReactNode } from "react";

const SCHOOL_CLASSES_DETAIL_PANEL_BREAKPOINT = 1280;

/**
 * Render one class detail panel inline on wide screens and as a sheet on
 * smaller screens so the route shape stays the same across devices.
 */
export function SchoolClassesDetailPanel({
  children,
  description,
  onClose,
  title,
}: {
  children: ReactNode;
  description: string;
  onClose: () => void;
  title: ReactNode;
}) {
  const isCompact = useMediaQuery(
    `(max-width: ${SCHOOL_CLASSES_DETAIL_PANEL_BREAKPOINT - 1}px)`
  );

  const desktopHeader = (
    <div className="border-b p-3">
      <div className="flex items-center justify-between gap-2">
        {title}

        <div className="flex items-center">
          <Button onClick={onClose} size="icon-sm" variant="ghost">
            <HugeIcons icon={Cancel01Icon} />
            <span className="sr-only">Close</span>
          </Button>
        </div>
      </div>
      <p className="sr-only">{description}</p>
    </div>
  );

  const mobileHeader = (
    <SheetHeader className="border-b p-3">
      <SheetTitle className="flex items-center justify-between gap-2">
        {title}

        <div className="flex items-center">
          <Button onClick={onClose} size="icon-sm" variant="ghost">
            <HugeIcons icon={Cancel01Icon} />
            <span className="sr-only">Close</span>
          </Button>
        </div>
      </SheetTitle>
      <SheetDescription className="sr-only">{description}</SheetDescription>
    </SheetHeader>
  );

  if (!isCompact) {
    return (
      <aside className="sticky top-0 hidden h-svh w-[28rem] min-w-0 shrink-0 flex-col border-l bg-background xl:flex">
        {desktopHeader}
        {children}
      </aside>
    );
  }

  return (
    <Sheet
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      open
    >
      <SheetContent
        className="max-w-none gap-0 border-l-0 sm:max-w-none"
        showCloseButton={false}
        style={{ width: "100%" }}
      >
        {mobileHeader}
        {children}
      </SheetContent>
    </Sheet>
  );
}
