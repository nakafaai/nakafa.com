"use client";

import { useMediaQuery } from "@mantine/hooks";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { useResizable } from "@repo/design-system/hooks/use-resizable";
import { cn } from "@repo/design-system/lib/utils";
import { Maximize2Icon, Minimize2Icon, XIcon } from "lucide-react";
import { SchoolClassesForumPostSheetContent } from "@/components/school/classes/forum/post-sheet-content";
import { SchoolClassesForumPostSheetInfo } from "@/components/school/classes/forum/post-sheet-info";
import { useForum } from "@/lib/context/use-forum";

const MIN_WIDTH = 448;
const MAX_WIDTH = 672;

export function SchoolClassesForumPostSheet() {
  const activeForumId = useForum((f) => f.activeForumId);
  const setActiveForumId = useForum((f) => f.setActiveForumId);

  const isMobile = useMediaQuery("(max-width: 768px)");

  const { width, isResizing, resizerProps, setWidth } = useResizable({
    initialWidth: MIN_WIDTH,
    minWidth: MIN_WIDTH,
    maxWidth: MAX_WIDTH,
  });

  return (
    <Sheet
      disablePointerDismissal
      modal={false}
      onOpenChange={(open) => {
        if (!open) {
          setActiveForumId(null);
        }
      }}
      open={!!activeForumId}
    >
      <SheetContent
        className={cn(
          "max-w-none gap-0 border-l-0 sm:max-w-none sm:border-l",
          !!isResizing && "transition-none"
        )}
        showCloseButton={false}
        style={{ width: isMobile ? "100%" : `${width}px` }}
      >
        <button
          className={cn(
            "absolute top-0 bottom-0 left-0 z-10 w-1 cursor-col-resize outline-0 ring-0 transition-colors hover:bg-accent",
            !!isResizing && "bg-accent",
            !!isMobile && "hidden"
          )}
          onKeyDown={resizerProps.onKeyDown}
          onMouseDown={resizerProps.onMouseDown}
          type="button"
        />
        <SheetHeader className="border-b p-3">
          <SheetTitle className="flex items-center justify-between gap-2">
            <SchoolClassesForumPostSheetInfo />

            <div className="flex items-center">
              <Button
                onClick={() => {
                  setWidth(
                    width === MAX_WIDTH ? (MIN_WIDTH ?? 0) : (MAX_WIDTH ?? 0)
                  );
                }}
                size="icon-sm"
                variant="ghost"
              >
                {width === MAX_WIDTH ? <Minimize2Icon /> : <Maximize2Icon />}
                <span className="sr-only">Resize</span>
              </Button>
              <Button
                onClick={() => setActiveForumId(null)}
                size="icon-sm"
                variant="ghost"
              >
                <XIcon />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </SheetTitle>
          <SheetDescription className="sr-only">
            Discuss anything with everyone in the class.
          </SheetDescription>
        </SheetHeader>

        <SchoolClassesForumPostSheetContent />
      </SheetContent>
    </Sheet>
  );
}
