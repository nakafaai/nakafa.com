import {
  Add01Icon,
  ArrowExpand01Icon,
  ArrowShrink02Icon,
  Cancel01Icon,
  ChatSearch01Icon,
  StarsIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  SheetDescription,
  SheetHeader as SheetHeaderPrimitive,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { lazyComponent } from "@repo/design-system/lib/lazy";
import { Activity, useState } from "react";
import { useTranslations } from "use-intl";
import { useAi } from "@/components/ai/context";
import { useViewer } from "@/lib/identity/client";

/** The recent chats and their query load when the learner shows intent on the history button. */
const SheetHistory = lazyComponent(
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
      <div className="flex items-center justify-between gap-2">
        {/* Only the name is the dialog's title: the buttons are not part of it. */}
        <SheetTitle className="flex items-center gap-2 px-2 text-chat">
          <HugeIcons className="size-4" icon={StarsIcon} />
          <span>Nina</span>
        </SheetTitle>

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
      </div>
      <SheetDescription className="sr-only">
        {t("Ai.sheet-description")}
      </SheetDescription>
    </SheetHeaderPrimitive>
  );
}

/**
 * The history button of a signed-in learner. The button and its menu root are
 * part of the header, so the header does not shift. The menu's content, which
 * holds the chat list and its query, mounts once the learner shows intent on
 * the button: a focus, a hover or a press. A learner who never does pays for
 * neither.
 */
function HistorySlot() {
  const t = useTranslations("Ai");
  const signedIn = useViewer(
    (state) => !state.isPending && state.viewer !== null
  );
  const [warmed, setWarmed] = useState(false);
  if (!signedIn) {
    return null;
  }
  return (
    <span className="inline-flex size-8">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          render={
            <Button
              onFocus={() => setWarmed(true)}
              onMouseEnter={() => setWarmed(true)}
              onPointerDown={() => setWarmed(true)}
              size="icon-sm"
              variant="ghost"
            >
              <HugeIcons icon={ChatSearch01Icon} />
              <span className="sr-only">{t("chat-history")}</span>
            </Button>
          }
        />
        {warmed ? <SheetHistory /> : null}
      </DropdownMenu>
    </span>
  );
}
