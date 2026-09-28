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

export const SCHOOL_CLASSES_DETAIL_PANEL_BREAKPOINT = 1280;

interface SchoolClassesDetailPanelProps {
  children: ReactNode;
  description: string;
  onClose: () => void;
  title: ReactNode;
}

/**
 * Render one class detail panel inline on wide screens and as a sheet on
 * smaller screens so the route shape stays the same across devices.
 */
export function SchoolClassesDetailPanel({
  children,
  description,
  onClose,
  title,
}: SchoolClassesDetailPanelProps) {
  const isCompact = useMediaQuery(
    `(max-width: ${SCHOOL_CLASSES_DETAIL_PANEL_BREAKPOINT - 1}px)`
  );

  if (!isCompact) {
    return (
      <aside className="sticky top-0 hidden h-svh w-full min-w-0 flex-col bg-background xl:flex">
        <div className="border-b p-3">
          <div className="flex items-center justify-between gap-2">
            {title}
            <SchoolClassesDetailPanelCloseButton onClose={onClose} />
          </div>
          <p className="sr-only">{description}</p>
        </div>
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
        <SheetHeader className="border-b p-3">
          <SheetTitle className="flex items-center justify-between gap-2">
            {title}
            <SchoolClassesDetailPanelCloseButton onClose={onClose} />
          </SheetTitle>
          <SheetDescription className="sr-only">{description}</SheetDescription>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}

/** Render the shared close action for the class detail panel header. */
function SchoolClassesDetailPanelCloseButton({
  onClose,
}: {
  onClose: () => void;
}) {
  return (
    <div className="flex items-center">
      <Button onClick={onClose} size="icon-sm" variant="ghost">
        <HugeIcons icon={Cancel01Icon} />
        <span className="sr-only">Close</span>
      </Button>
    </div>
  );
}
