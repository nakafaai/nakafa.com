"use client";

import { Search02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { usePathname } from "@repo/internationalization/src/navigation";
import { IconCommand, IconLetterK } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { useSearch } from "@/lib/context/use-search";

export function HeaderSearch() {
  const pathname = usePathname();
  const t = useTranslations("Utils");
  const id = useId();

  const setOpen = useSearch((state) => state.setOpen);

  if (pathname === "/search") {
    return null;
  }

  return (
    <button
      className="w-full cursor-pointer sm:w-auto"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOpen(true);
      }}
      type="button"
    >
      <Label className="sr-only" htmlFor={id}>
        {t("search")}
      </Label>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center pl-3">
          <HugeIcons
            className="size-4 text-muted-foreground"
            icon={Search02Icon}
          />
        </div>
        <Input
          className="pointer-events-none h-8 border border-border bg-background pl-9 shadow-xs transition-colors placeholder:text-sm hover:bg-accent hover:text-accent-foreground focus-visible:ring-0 sm:w-80 dark:hover:bg-input/50"
          id={id}
          placeholder={t("search-bar-placeholder")}
          type="text"
        />
        <div className="pointer-events-none absolute inset-e-0 inset-y-0 hidden items-center justify-center pe-3 lg:flex">
          <div className="flex items-center gap-1">
            <kbd className="rounded border bg-background p-0.75">
              <IconCommand className="size-3 shrink-0" />
              <span className="sr-only">Command/Ctrl</span>
            </kbd>
            <kbd className="rounded border bg-background p-0.75">
              <IconLetterK className="size-3 shrink-0" strokeWidth={2} />
              <span className="sr-only">K</span>
            </kbd>
          </div>
        </div>
      </div>
    </button>
  );
}
