import {
  Archive02Icon,
  Delete02Icon,
  Edit02Icon,
  Globe02Icon,
  LanguageSquareIcon,
  Share08Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { useTranslations } from "use-intl";

export const card = {
  name: "DropdownMenu",
  group: "Menus",
  height: 300,
  source: "components/ui/dropdown-menu",
};

/** A menu reads as header, body and footer: its one-word label, its main actions, then Archive and Delete last. */
export function Preview() {
  const t = useTranslations("Common");
  return (
    <div className="p-6">
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger render={<Button variant="outline" />}>
          Exam
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" label={t("menu-exam")}>
          <DropdownMenuItem icon={Edit02Icon}>Edit</DropdownMenuItem>
          <DropdownMenuItem icon={Share08Icon}>Share</DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger icon={LanguageSquareIcon}>
              Language
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent label={t("menu-language")}>
              <DropdownMenuRadioGroup defaultValue="en">
                <DropdownMenuRadioItem icon={Globe02Icon} value="en">
                  English
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem icon={Globe02Icon} value="id">
                  Bahasa Indonesia
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem icon={Archive02Icon}>Archive</DropdownMenuItem>
          <DropdownMenuItem icon={Delete02Icon} variant="destructive">
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
