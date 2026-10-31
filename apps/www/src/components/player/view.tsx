import { File01Icon, ListViewIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect, Option } from "effect";
import { useTransition } from "react";
import { useTranslations } from "use-intl";
import { decodePlayerMode } from "@/components/player/mode";
import { usePlayer } from "@/components/player/provider";
import { rememberPlayerMode } from "@/components/player/remember";

/**
 * The view of the player in its header, beside the one primary action: the list
 * or one question at a time, chosen from a menu behind one button that shows the
 * current view's icon. So the header holds at most two buttons,
 * the view and Finish. A player with no questions, such as a sitting whose paper
 * failed to load, shows no view.
 */
export function PlayerViewSwitch() {
  const shown = usePlayer((state) => state.keys.length > 0);

  if (!shown) {
    return null;
  }

  return (
    <div className="flex items-center" data-player-view="">
      <PlayerViewMenu />
    </div>
  );
}

/**
 * Applies a chosen view: it shows at once, and the choice is saved in a
 * transition. When it cannot be saved the last saved view comes back, unless the
 * learner chose again since. Choosing the shown view changes nothing.
 */
function useChooseView() {
  const choose = usePlayer((state) => state.choose);
  const [, startTransition] = useTransition();

  return (value: string) => {
    const next = decodePlayerMode(value);
    if (Option.isNone(next)) {
      return;
    }
    startTransition(async () => {
      const choice = await Effect.runPromise(
        choose(next.value, rememberPlayerMode(next.value))
      );
      if (choice === "reverted") {
        toast.error(
          {
            description: "mode-error.description",
            title: "mode-error.title",
          },
          { position: "bottom-center" }
        );
      }
    });
  };
}

/**
 * The view's menu: its button shows the current view's icon beside its name, as Finish beside it does, and
 * the icon alone on a phone, where the name stays for a screen reader; each choice carries its own icon.
 */
function PlayerViewMenu() {
  const t = useTranslations("Player");
  const mode = usePlayer((state) => state.mode);
  const onValueChange = useChooseView();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" variant="outline" />}>
        <HugeIcons icon={mode === "single" ? File01Icon : ListViewIcon} />
        <span className="max-sm:sr-only">{t("mode")}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup onValueChange={onValueChange} value={mode}>
          <DropdownMenuRadioItem value="list">
            <HugeIcons icon={ListViewIcon} />
            {t("mode-list")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="single">
            <HugeIcons icon={File01Icon} />
            {t("mode-single")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
