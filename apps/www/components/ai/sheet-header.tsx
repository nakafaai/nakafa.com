"use client";

import {
  Add01Icon,
  ArrowExpand01Icon,
  ArrowShrink02Icon,
  Cancel01Icon,
  StarsIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  SheetDescription,
  SheetHeader as SheetHeaderPrimitive,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { Activity } from "react";
import { useAi } from "@/components/ai/context/use-ai";
import { SheetHistory } from "@/components/ai/sheet-history";

interface Props {
  expanded: boolean;
  onResizeToggle: () => void;
}

/** Renders Nina sheet actions without owning the sheet layout. */
export function AiSheetHeader({ expanded, onResizeToggle }: Props) {
  const activeChatId = useAi((state) => state.activeChatId);
  const setActiveChatId = useAi((state) => state.setActiveChatId);
  const setOpen = useAi((state) => state.setOpen);

  return (
    <SheetHeaderPrimitive className="border-b p-3">
      <SheetTitle className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 px-2">
          <div className="flex items-center gap-2 text-base">
            <HugeIcons className="size-4" icon={StarsIcon} />
            <span>Nina</span>
          </div>
        </div>

        <div className="flex items-center">
          <Activity mode={activeChatId ? "visible" : "hidden"}>
            <Button
              onClick={() => setActiveChatId(null)}
              size="icon-sm"
              variant="ghost"
            >
              <HugeIcons icon={Add01Icon} />
              <span className="sr-only">New Chat</span>
            </Button>
          </Activity>
          <SheetHistory />
          <Button onClick={onResizeToggle} size="icon-sm" variant="ghost">
            <HugeIcons
              icon={expanded ? ArrowShrink02Icon : ArrowExpand01Icon}
            />
            <span className="sr-only">Resize</span>
          </Button>
          <Button onClick={() => setOpen(false)} size="icon-sm" variant="ghost">
            <HugeIcons icon={Cancel01Icon} />
            <span className="sr-only">Close</span>
          </Button>
        </div>
      </SheetTitle>
      <SheetDescription className="sr-only">
        Nina is a chatbot that can help you with your questions.
      </SheetDescription>
    </SheetHeaderPrimitive>
  );
}
