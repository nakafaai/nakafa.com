"use client";

import { usePathname } from "@/i18n/routing";
import { searchAtom } from "@/lib/jotai/search";
import { cn } from "@/lib/utils";
import { useSetAtom } from "jotai";
import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

type Props = {
  className?: string;
  forceOpen?: boolean;
};

export function SearchBar({ className, forceOpen = false }: Props) {
  const t = useTranslations("Utils");
  const id = useId();

  const pathname = usePathname();

  const setOpen = useSetAtom(searchAtom);

  // If the pathname is /, don't show the search bar
  if (pathname === "/" && !forceOpen) {
    return null;
  }

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOpen(true);
      }}
      type="button"
    >
      <Label htmlFor={id} className="sr-only">
        {t("search")}
      </Label>
      <div className="relative">
        <SearchIcon className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
        <Input
          id={id}
          className={cn(
            "h-8 cursor-pointer bg-muted/50 pe-10 pl-9 shadow-none transition-colors placeholder:text-sm hover:bg-muted/80 focus-visible:ring-0 sm:w-80",
            className
          )}
          placeholder={t("search-bar-placeholder")}
          type="search"
        />
        <div className="pointer-events-none absolute inset-y-0 end-0 flex items-center justify-center pe-2">
          <kbd className="inline-flex h-5 max-h-full items-center rounded border bg-background px-1 font-[inherit] font-medium text-[0.625rem] text-foreground">
            ⌘ K
          </kbd>
        </div>
      </div>
    </button>
  );
}
