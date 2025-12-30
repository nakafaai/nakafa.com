"use client";

import {
  ArrowDownLeftIcon,
  Cancel01Icon,
  Search02Icon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { cn } from "@repo/design-system/lib/utils";
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
      <Label className="sr-only" htmlFor={id}>
        {t("search")}
      </Label>
      <Input
        autoComplete="off"
        className={cn(
          "h-12 border-border bg-card/80 px-9 backdrop-blur-sm sm:w-full",
          className
        )}
        id={id}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            action?.();
          }
        }}
        placeholder={t("search-bar-placeholder")}
        type="text"
        value={value}
        {...props}
      />
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center pl-3 text-muted-foreground">
        <HugeIcons className="size-4" icon={Search02Icon} />
      </div>
      <button
        aria-label="Clear search"
        className={cn(
          "absolute inset-y-0 right-0 flex h-full w-9 cursor-pointer items-center justify-center rounded-e-md text-muted-foreground opacity-0 outline-none transition-[color,box-shadow] hover:text-foreground",
          !!value && "opacity-100",
          !!action && "right-9"
        )}
        disabled={loading}
        onClick={() => setValue("")}
        type="button"
      >
        <HugeIcons
          aria-hidden="true"
          className="size-4 shrink-0"
          icon={Cancel01Icon}
        />
        <span className="sr-only">Clear search</span>
      </button>

      {!!action && (
        <button
          className="absolute inset-y-0 end-0 flex h-full cursor-pointer items-center justify-center pe-3 text-muted-foreground disabled:cursor-default disabled:opacity-50 peer-disabled:opacity-50"
          disabled={loading || !value}
          onClick={action}
          type="button"
        >
          <kbd className="flex size-6 items-center justify-center rounded-md border bg-primary text-primary-foreground">
            <Spinner
              aria-hidden="true"
              className="size-3"
              icon={ArrowDownLeftIcon}
            />
            <span className="sr-only">Search</span>
          </kbd>
        </button>
      )}
    </div>
  );
}
