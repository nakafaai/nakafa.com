"use client";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import { IconCommand, IconLetterK } from "@tabler/icons-react";
import { SearchIcon } from "lucide-react";
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
          className="cursor-pointer justify-between text-muted-foreground"
          isActive={open}
          onClick={() => setOpen(true)}
          variant="outline"
        >
          <div className="flex items-center gap-2">
            <SearchIcon className="size-4" />
            <span>{t("search-bar-placeholder")}</span>
          </div>
          <div className="hidden items-center lg:flex">
            <kbd className="rounded">
              <IconCommand className="size-3.5 shrink-0" />
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
