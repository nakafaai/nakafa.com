"use client";

import { ArrowRight01Icon, TranslateIcon } from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import { useTranslations } from "next-intl";
import { useLayoutEffect } from "react";
import { LangMenuSwitcher } from "./lang-menu-switcher";

/**
 * Renders the sidebar language menu.
 *
 * The dropdown is transient UI, so it resets closed when Next hides the app
 * shell through Cache Components state preservation.
 *
 * References:
 * - Next.js preserving UI state with Cache Components:
 *   `apps/www/node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md`
 * - Mantine `useDisclosure`:
 *   https://mantine.dev/hooks/use-disclosure/
 */
export function LangMenu() {
  const t = useTranslations("Common");
  const [open, { close, set }] = useDisclosure(false);

  useLayoutEffect(() => close, [close]);

  return (
    <DropdownMenu onOpenChange={set} open={open}>
      <SidebarMenuItem>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton tooltip={t("language")}>
            <HugeIcons icon={TranslateIcon} />
            <span className="truncate">{t("language")}</span>

            <HugeIcons className="ml-auto" icon={ArrowRight01Icon} />
          </SidebarMenuButton>
        </DropdownMenuTrigger>

        <LangMenuSwitcher />
      </SidebarMenuItem>
    </DropdownMenu>
  );
}
