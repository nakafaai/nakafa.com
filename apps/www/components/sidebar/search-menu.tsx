"use client";

import { CommandIcon, Search02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import { IconLetterK } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useSearch } from "@/lib/context/use-search";

export function SearchMenu() {
  const t = useTranslations("Utils");
  const { open, setOpen } = useSearch((state) => ({
    open: state.open,
    setOpen: state.setOpen,
  }));

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          className="justify-between text-muted-foreground"
          isActive={open}
          onClick={() => setOpen(true)}
          variant="outline"
        >
          <div className="flex items-center gap-2">
            <HugeIcons className="size-4" icon={Search02Icon} />
            <span>{t("search-bar-placeholder")}</span>
          </div>
          <div className="hidden items-center lg:flex">
            <kbd className="rounded">
              <HugeIcons className="size-3.5 shrink-0" icon={CommandIcon} />
              <span className="sr-only">Command/Ctrl</span>
            </kbd>
            <kbd className="rounded">
              <IconLetterK className="size-3.5 shrink-0" />
              <span className="sr-only">K</span>
            </kbd>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
