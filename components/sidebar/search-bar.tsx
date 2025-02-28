"use client";

import { searchAtom } from "@/lib/jotai/search";
import { useSetAtom } from "jotai";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

export function SearchBar() {
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
    >
      <Label htmlFor={id} className="sr-only">
        {t("search")}
      </Label>
      <div className="relative">
        <Input
          id={id}
          className="h-8 cursor-pointer bg-muted/50 pe-12 shadow-none transition-colors hover:bg-muted"
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
