import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { themeOptions } from "@repo/design-system/lib/theme/options";
import { useTheme } from "@repo/design-system/providers/theme";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { ActiveBadge } from "@/components/shared/active";

const BASE_THEMES_COUNT = 3;

/** Renders one group of themes. The selected theme lives in the theme store. */
function ThemeGroup({ options }: { options: typeof themeOptions }) {
  const currentTheme = useTheme((state) => state.theme);
  const setTheme = useTheme((state) => state.setTheme);
  const t = useTranslations("Common");

  return (
    <DropdownMenuGroup>
      {Arr.map(options, (theme) => (
        <DropdownMenuItem
          className="cursor-pointer"
          key={theme.value}
          onClick={() => setTheme(theme.value)}
        >
          <HugeIcons className="shrink-0" icon={theme.icon} />
          <span className="truncate">{t(theme.value)}</span>
          <ActiveBadge isActive={currentTheme === theme.value} />
        </DropdownMenuItem>
      ))}
    </DropdownMenuGroup>
  );
}

/**
 * Lists light, dark and system first, then every named theme.
 *
 * The theme list carries one icon for each theme, about 31 kB, so every menu
 * that shows it loads this module on demand instead of with the page.
 */
export function ThemeMenuItems() {
  return (
    <>
      <ThemeGroup options={Arr.take(themeOptions, BASE_THEMES_COUNT)} />
      <DropdownMenuSeparator />
      <ThemeGroup options={Arr.drop(themeOptions, BASE_THEMES_COUNT)} />
    </>
  );
}
