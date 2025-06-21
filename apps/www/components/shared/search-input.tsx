"use client";

import { SpinnerIcon } from "@repo/design-system/components/ui/icons";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { cn } from "@repo/design-system/lib/utils";
import { CornerDownLeftIcon, SearchIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { type HTMLAttributes, useId } from "react";

type Props = {
  value: string;
  setValue: (value: string) => void;
  className?: string;
  loading?: boolean;
  action?: () => void;
} & HTMLAttributes<HTMLInputElement>;

export function SearchInput({
  value,
  setValue,
  className,
  loading,
  action,
  ...props
}: Props) {
  const t = useTranslations("Utils");
  const id = useId();

  return (
    <div className="relative">
      <Label htmlFor={id} className="sr-only">
        {t("search")}
      </Label>
      <Input
        id={id}
        className={cn(
          "h-12 border-border px-9 backdrop-blur-sm sm:w-full",
          className
        )}
        placeholder={t("search-bar-placeholder")}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            action?.();
          }
        }}
        autoComplete="off"
        {...props}
      />
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center pl-3 text-muted-foreground">
        <SearchIcon className="size-4" />
      </div>
      {loading ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 end-0 flex items-center justify-center pe-3 text-muted-foreground peer-disabled:opacity-50",
            action && "right-9"
          )}
        >
          <SpinnerIcon className="size-4" aria-hidden="true" />
        </div>
      ) : (
        <button
          className={cn(
            "absolute inset-y-0 end-0 flex h-full w-9 cursor-pointer items-center justify-center rounded-e-md text-muted-foreground opacity-0 outline-none transition-[color,box-shadow] hover:text-foreground",
            value && "opacity-100",
            action && "right-9"
          )}
          aria-label="Clear search"
          type="button"
          onClick={() => setValue("")}
        >
          <XIcon className="size-4 shrink-0" aria-hidden="true" />
          <span className="sr-only">Clear search</span>
        </button>
      )}
      {action && (
        <button
          className="absolute inset-y-0 end-0 flex h-full cursor-pointer items-center justify-center pe-3 text-muted-foreground disabled:cursor-default disabled:opacity-50 peer-disabled:opacity-50"
          type="button"
          onClick={action}
          disabled={loading || !value}
        >
          <kbd className="flex size-6 items-center justify-center rounded-md border bg-primary text-primary-foreground">
            <CornerDownLeftIcon className="size-3" />
            <span className="sr-only">Search</span>
          </kbd>
        </button>
      )}
    </div>
  );
}
