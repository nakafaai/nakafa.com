import {
  ArrowRight01Icon,
  PaintBoardIcon,
  TranslateIcon,
} from "@hugeicons/core-free-icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { useSidebar } from "@repo/design-system/lib/sidebar/context";
import { languages } from "@repo/internationalization/data/lang";
import { ClientOnly } from "@tanstack/react-router";
import { Array as Arr } from "effect";
import { lazy, Suspense } from "react";
import { type Locale, useLocale, useTranslations } from "use-intl";
import { ActiveBadge } from "@/components/shared/active";
import { CountryFlagIcon } from "@/components/shared/flag";
import { selectMenuSide } from "@/components/sidebar/menu/side";
import { useLocalizedRouteSwitch } from "@/lib/routing/locale/client";

/**
 * Loads the theme submenu when the account menu opens. Its list carries one
 * icon for each theme, which no page needs before that.
 */
const ThemeSubmenuContent = lazy(() =>
  import("@/components/sidebar/menu/theme").then((module) => ({
    default: module.ThemeSubmenuContent,
  }))
);

/** Keeps the language control label identical across guest and account menus. */
function LanguageMenuTriggerContent({ label }: { label: string }) {
  return (
    <>
      <HugeIcons icon={TranslateIcon} />
      <span className="truncate">{label}</span>
    </>
  );
}

/** Renders the nested language submenu and delegates route projection to the shared switcher seam. */
function LanguageMenuItems() {
  const { isPending, replace } = useLocalizedRouteSwitch();
  const currentLocale = useLocale();

  /** Replaces the current route with the selected locale. */
  function handleChangeLocale(locale: Locale) {
    replace(locale);
  }

  return (
    <>
      {Arr.map(languages, (language) => (
        <DropdownMenuItem
          className="cursor-pointer"
          disabled={isPending}
          key={language.value}
          onClick={() => handleChangeLocale(language.value)}
        >
          <CountryFlagIcon countryCode={language.countryCode} />
          <span className="truncate">{language.label}</span>
          <ActiveBadge isActive={currentLocale === language.value} />
        </DropdownMenuItem>
      ))}
    </>
  );
}

/** Renders the shared language capability as a hoverable guest sidebar menu. */
export function GuestLanguageMenu() {
  const t = useTranslations("Common");
  const side = useSidebar(selectMenuSide);
  const label = t("language");

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger
          openOnHover
          render={
            <SidebarMenuButton title={label}>
              <LanguageMenuTriggerContent label={label} />
              <HugeIcons
                className="ml-auto opacity-80"
                data-slot="language-menu-indicator"
                icon={ArrowRight01Icon}
              />
            </SidebarMenuButton>
          }
        />
        <DropdownMenuContent
          align="start"
          className="w-max max-w-[calc(100vw-2rem)]"
          side={side}
          sideOffset={4}
        >
          <DropdownMenuGroup>
            <LanguageMenuItems />
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}

/** The language submenu of an account menu, shared by the Nakafa and the school menus. */
export function SidebarLanguageSubmenu() {
  const t = useTranslations("Common");
  const side = useSidebar(selectMenuSide);

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="cursor-pointer">
        <LanguageMenuTriggerContent label={t("language")} />
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent
        className="w-max max-w-[calc(100vw-2rem)]"
        side={side}
      >
        <DropdownMenuGroup>
          <LanguageMenuItems />
        </DropdownMenuGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

/** The theme submenu of an account menu, shared by the Nakafa and the school menus. */
export function SidebarThemeSubmenu() {
  const t = useTranslations("Common");
  const side = useSidebar(selectMenuSide);

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="cursor-pointer">
        <HugeIcons icon={PaintBoardIcon} />
        <span className="truncate">{t("theme")}</span>
      </DropdownMenuSubTrigger>
      <Suspense fallback={null}>
        <ClientOnly fallback={null}>
          <ThemeSubmenuContent side={side} />
        </ClientOnly>
      </Suspense>
    </DropdownMenuSub>
  );
}
