"use client";

import { searchAtom } from "@/lib/jotai/search";
import { cn } from "@/lib/utils";
import { IconCommand, IconLetterK } from "@tabler/icons-react";
import { useSetAtom } from "jotai";
import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

type Props = {
  className?: string;
};

export function SearchBar({ className }: Props) {
  const t = useTranslations("Utils");
  const id = useId();

  const setOpen = useSetAtom(searchAtom);

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOpen(true);
      }}
      type="button"
      className="w-full sm:w-auto"
    >
      <Label htmlFor={id} className="sr-only">
        {t("search")}
      </Label>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center pl-3">
          <SearchIcon className="size-4 text-muted-foreground" />
        </div>
        <Input
          id={id}
          className={cn(
            "h-8 cursor-pointer border-border bg-muted/50 pe-11 pl-9 transition-colors placeholder:text-sm hover:bg-muted/80 focus-visible:ring-0 sm:w-80",
            className
          )}
          placeholder={t("search-bar-placeholder")}
          type="search"
        />
        <div className="pointer-events-none absolute inset-y-0 end-0 hidden items-center justify-center pe-3 lg:flex">
          <div className="flex items-center gap-0.5">
            <kbd className="rounded border bg-background p-0.75">
              <IconCommand className="size-3 shrink-0" />
              <span className="sr-only">Command/Ctrl</span>
            </kbd>
            <kbd className="rounded border bg-background p-0.75">
              <IconLetterK className="size-3 shrink-0" />
              <span className="sr-only">K</span>
            </kbd>
          </div>
        </div>
      </div>
    </button>
  );
}
