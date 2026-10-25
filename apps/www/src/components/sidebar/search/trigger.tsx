"use client";

import { CommandIcon, Search02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { Effect } from "effect";
import { useTranslations } from "use-intl";
import { preloadSearchCommand } from "@/components/search/command/module";
import { useSearch } from "@/lib/search/context";

/**
 * Warms command search on the reader's intent: its module loads, and the palette
 * mounts hidden, so the press that opens it finds its body ready.
 */
function usePreloadSearchCommand() {
  const warm = useSearch((state) => state.warm);
  function preload() {
    warm();
    Effect.runFork(preloadSearchCommand());
  }

  return {
    onFocus: preload,
    onMouseEnter: preload,
    onTouchStart: preload,
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
            <kbd className="rounded">K</kbd>
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
          <HugeIcons className="size-3 shrink-0" icon={CommandIcon} />
          <span className="sr-only">Command/Ctrl</span>
        </kbd>
        <kbd className="rounded border p-0.75">K</kbd>
      </span>
    </Button>
  );
}
