"use client";

import { useSearch } from "@/lib/context/use-search";
import { IconCommand, IconLetterK } from "@tabler/icons-react";
import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../ui/sidebar";

export function SearchMenu() {
  const t = useTranslations("Utils");
  const { open, setOpen } = useSearch((state) => ({
    open: state.open,
    setOpen: state.setOpen,
  }));

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="sr-only">{t("search")}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={open}
              onClick={() => setOpen(true)}
              variant="outline"
              className="justify-between text-muted-foreground"
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
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
