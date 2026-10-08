"use client";

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
import {
  type SidebarContextValue,
  useSidebar,
} from "@repo/design-system/lib/sidebar/context";
import { languages } from "@repo/internationalization/data/lang";
import { IconCircleFilled } from "@tabler/icons-react";
import { cn } from "cn";
import dynamic from "next/dynamic";
import { type Locale, useLocale, useTranslations } from "next-intl";
import { CountryFlagIcon } from "@/components/shared/flag";
import { useLocalizedRouteSwitch } from "@/lib/routing/locale/client";

/**
 * Loads the theme submenu when the account menu opens. Its list carries one
 * icon for each theme, which no page needs before that.
 */
const ThemeSubmenuContent = dynamic(
  () =>
    import("@/components/sidebar/menu/theme").then(
      (module) => module.ThemeSubmenuContent
    ),
  {
    loading: () => null,
    ssr: false,
  }
);

/** Opens menus beside the sidebar, or above their trigger on phones, where the sidebar fills the screen. */
function selectMenuSide(sidebar: SidebarContextValue) {
  return sidebar.isMobile ? "top" : "right";
}

/** Shows the active menu option without changing the item label layout. */
function ActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <IconCircleFilled
      className={cn(
        "ml-auto size-3 text-primary opacity-0 transition-opacity",
        isActive && "opacity-100"
      )}
    />
  );
}

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
      {languages.map((language) => (
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

/** Renders language options inside the account preference submenu. */
function LanguageSubmenuContent() {
  const side = useSidebar(selectMenuSide);

  return (
    <DropdownMenuSubContent
      className="w-max max-w-[calc(100vw-2rem)]"
      side={side}
    >
      <DropdownMenuGroup>
        <LanguageMenuItems />
      </DropdownMenuGroup>
    </DropdownMenuSubContent>
  );
}

/** Provides preference submenus that can be mounted from account menu surfaces. */
export function SidebarPreferenceSubmenus() {
  const t = useTranslations("Common");
  const side = useSidebar(selectMenuSide);

  return (
    <DropdownMenuGroup>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger className="cursor-pointer">
          <LanguageMenuTriggerContent label={t("language")} />
        </DropdownMenuSubTrigger>
        <LanguageSubmenuContent />
      </DropdownMenuSub>

      <DropdownMenuSub>
        <DropdownMenuSubTrigger className="cursor-pointer">
          <HugeIcons icon={PaintBoardIcon} />
          <span className="truncate">{t("theme")}</span>
        </DropdownMenuSubTrigger>
        <ThemeSubmenuContent side={side} />
      </DropdownMenuSub>
    </DropdownMenuGroup>
  );
}
