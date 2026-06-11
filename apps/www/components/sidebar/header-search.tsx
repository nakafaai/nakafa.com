"use client";

import { Search02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/icons/huge-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { usePathname } from "@repo/internationalization/src/navigation";
import { IconCommand, IconLetterK } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useSearch } from "@/lib/context/use-search";

/** Renders the header search trigger that opens the command search dialog. */
export function HeaderSearch() {
  const pathname = usePathname();
  const t = useTranslations("Utils");

  const setOpen = useSearch((state) => state.setOpen);

  if (pathname === "/search") {
    return null;
  }

  return (
    <Button
      aria-label={t("search")}
      className="w-full justify-between text-muted-foreground sm:w-80"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOpen(true);
      }}
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
        <kbd className="rounded border bg-background p-0.75">
          <IconCommand className="size-3 shrink-0" />
          <span className="sr-only">Command/Ctrl</span>
        </kbd>
        <kbd className="rounded border bg-background p-0.75">
          <IconLetterK className="size-3 shrink-0" strokeWidth={2} />
          <span className="sr-only">K</span>
        </kbd>
      </span>
    </Button>
  );
}
