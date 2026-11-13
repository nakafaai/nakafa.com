import {
  ArrowRight01Icon,
  PaintBoardIcon,
  TranslateIcon,
} from "@hugeicons/core-free-icons";
import {
  DropdownMenu,
  DropdownMenuContent,
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
import { lazy } from "@repo/design-system/lib/lazy";
import { useSidebar } from "@repo/design-system/lib/sidebar/context";
import { ClientOnly } from "@tanstack/react-router";
import { Suspense } from "react";
import { useTranslations } from "use-intl";
import { RouteLanguageItems } from "@/components/shared/language";
import { selectMenuSide } from "@/components/sidebar/menu/side";

/**
 * Loads the theme submenu when the account menu opens. Its list carries one
 * icon for each theme, which no page needs before that.
 */
const ThemeSubmenuContent = lazy(() =>
  import("@/components/sidebar/menu/theme").then((module) => ({
    default: module.ThemeSubmenuContent,
  }))
);

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
              <HugeIcons icon={TranslateIcon} />
              <span className="truncate">{label}</span>
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
          label={t("menu-language")}
          side={side}
          sideOffset={4}
        >
          <RouteLanguageItems />
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
      <DropdownMenuSubTrigger icon={TranslateIcon}>
        <span className="truncate">{t("language")}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent
        className="w-max max-w-[calc(100vw-2rem)]"
        label={t("menu-language")}
        side={side}
      >
        <RouteLanguageItems />
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
      <DropdownMenuSubTrigger icon={PaintBoardIcon}>
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
