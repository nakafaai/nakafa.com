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
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Activity } from "react";
import { useAi } from "@/components/ai/context";
import { useViewer } from "@/lib/identity/client";

/** The chat list and its query load with the sheet's body, not with the shell. */
const SheetHistory = dynamic(
  () =>
    import("@/components/ai/sheet/history").then(
      (module) => module.SheetHistory
    ),
  { loading: () => null, ssr: false }
);

interface Props {
  expanded: boolean;
  onResizeToggle: () => void;
}

/** Renders Nina sheet actions without owning the sheet layout. */
export function AiSheetHeader({ expanded, onResizeToggle }: Props) {
  const activeChatId = useAi((state) => state.activeChatId);
  const setActiveChatId = useAi((state) => state.setActiveChatId);
  const setOpen = useAi((state) => state.setOpen);
  const t = useTranslations();

  return (
    <SheetHeaderPrimitive className="border-b p-3">
      <SheetTitle className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 px-2">
          <div className="flex items-center gap-2 text-chat">
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
              <span className="sr-only">{t("Ai.new-chat")}</span>
            </Button>
          </Activity>
          <HistorySlot />
          <Button
            className="hidden sm:inline-flex"
            onClick={onResizeToggle}
            size="icon-sm"
            variant="ghost"
          >
            <HugeIcons
              icon={expanded ? ArrowShrink02Icon : ArrowExpand01Icon}
            />
            <span className="sr-only">
              {t(expanded ? "Ai.narrower" : "Ai.wider")}
            </span>
          </Button>
          <Button onClick={() => setOpen(false)} size="icon-sm" variant="ghost">
            <HugeIcons icon={Cancel01Icon} />
            <span className="sr-only">{t("Common.close")}</span>
          </Button>
        </div>
      </SheetTitle>
      <SheetDescription className="sr-only">
        {t("Ai.sheet-description")}
      </SheetDescription>
    </SheetHeaderPrimitive>
  );
}

/**
 * Holds the history button's place for a signed-in learner, so the header
 * does not shift when the button's code arrives.
 */
function HistorySlot() {
  const signedIn = useViewer(
    (state) => !state.isPending && state.viewer !== null
  );
  if (!signedIn) {
    return null;
  }
  return (
    <span className="inline-flex size-8">
      <SheetHistory />
    </span>
  );
}
