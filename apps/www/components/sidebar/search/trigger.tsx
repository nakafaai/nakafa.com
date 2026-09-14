"use client";

import { CommandIcon, Search02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { IconCommand, IconLetterK } from "@tabler/icons-react";
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import { preloadSearchCommand } from "@/components/shared/search-command-module";
import { useSearch } from "@/lib/context/use-search";

/** Preloads the search command module ahead of the first open. */
function usePreloadSearchCommand() {
  return {
    onFocus: () => Effect.runFork(preloadSearchCommand()),
    onMouseEnter: () => Effect.runFork(preloadSearchCommand()),
    onTouchStart: () => Effect.runFork(preloadSearchCommand()),
  };
}

/** Renders the command search trigger inside the sidebar header. */
export function SearchMenu() {
  const t = useTranslations("Utils");
  const preload = usePreloadSearchCommand();
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
          onFocus={preload.onFocus}
          onMouseEnter={preload.onMouseEnter}
          onTouchStart={preload.onTouchStart}
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

/** Renders the header search trigger that opens the command search dialog. */
export function HeaderSearch() {
  const t = useTranslations("Utils");
  const preload = usePreloadSearchCommand();

  const setOpen = useSearch((state) => state.setOpen);

  return (
    <Button
      aria-label={t("search")}
      className="w-full justify-between text-muted-foreground sm:w-80"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOpen(true);
      }}
      onFocus={preload.onFocus}
      onMouseEnter={preload.onMouseEnter}
      onTouchStart={preload.onTouchStart}
      type="button"
      variant="outline"
    >
      <span className="flex min-w-0 items-center gap-2">
        <HugeIcons className="size-4" icon={Search02Icon} />
        <span className="truncate font-normal">
          {t("search-bar-placeholder")}
        </span>
      </span>
      <span className="hidden items-center gap-1 lg:flex">
        <kbd className="rounded border p-0.75">
          <IconCommand className="size-3 shrink-0" />
          <span className="sr-only">Command/Ctrl</span>
        </kbd>
        <kbd className="rounded border p-0.75">
          <IconLetterK className="size-3 shrink-0" strokeWidth={2} />
          <span className="sr-only">K</span>
        </kbd>
      </span>
    </Button>
  );
}
