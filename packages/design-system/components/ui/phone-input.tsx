"use client";

import {
  ArrowDown01Icon,
  Call02Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/design-system/components/ui/command";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";
import type React from "react";
import { useMemo, useState } from "react";
import * as RpnInput from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import { VList } from "virtua";

type PhoneInputProps = {
  className?: string;
} & React.ComponentProps<typeof RpnInput.default>;

export default function PhoneInput({ className, ...props }: PhoneInputProps) {
  return (
    <div className={cn("*:not-first:mt-2", className)} dir="ltr">
      <RpnInput.default
        className="flex shadow-xs"
        countrySelectComponent={CountrySelect}
        defaultCountry="ID"
        flagComponent={FlagComponent}
        inputComponent={Phone}
        international
        {...props}
      />
    </div>
  );
}

function Phone({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <Input
      className={cn(
        "-ms-px rounded-s-none shadow-none focus-visible:z-10",
        className
      )}
      data-slot="phone-input"
      {...props}
    />
  );
}

interface CountrySelectProps {
  disabled?: boolean;
  onChange: (value: RpnInput.Country) => void;
  options: { label: string; value: RpnInput.Country | undefined }[];
  value: RpnInput.Country;
}

const CountrySelect = ({ value, onChange, options }: CountrySelectProps) => {
  const t = useTranslations("Common");

  const [searchQuery, setSearchQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filteredCountries = useMemo(() => {
    const validOptions = options.filter((c) => c.value !== undefined);

    let filtered = validOptions;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = validOptions.filter(
        (c) =>
          c.label.toLowerCase().includes(q) ||
          c.value?.toLowerCase().includes(q)
      );
    }

    // Place selected country at the top
    const selectedIndex = filtered.findIndex((c) => c.value === value);
    if (selectedIndex > 0) {
      const selected = filtered[selectedIndex];
      return [selected, ...filtered.filter((c) => c.value !== value)];
    }

    return filtered;
  }, [searchQuery, options, value]);

  return (
    <Popover modal onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          className="inline-flex items-center rounded-r-none border px-3 hover:bg-accent hover:text-accent-foreground"
          variant="ghost"
        >
          <FlagComponent
            aria-hidden="true"
            country={value}
            countryName={value}
          />
          <span className="text-muted-foreground">
            <HugeIcons
              aria-hidden="true"
              className="ml-auto h-4 w-4 shrink-0 opacity-50"
              icon={ArrowDown01Icon}
            />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-full border-[color-mix(in_oklch,var(--input)_5%,var(--border))] p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            onValueChange={setSearchQuery}
            placeholder={t("search-country-placeholder")}
            value={searchQuery}
          />
          <CommandList>
            <CommandEmpty>{t("no-country-found")}</CommandEmpty>
            <CommandGroup
              className={cn("p-0", filteredCountries.length === 0 && "hidden")}
            >
              <VList
                className="p-1"
                data={filteredCountries}
                style={{ height: "200px" }}
              >
                {(c) => (
                  <CommandItem
                    className="flex cursor-pointer items-center justify-between gap-2"
                    key={c.value}
                    onSelect={() => {
                      if (!c.value) {
                        return;
                      }
                      onChange(c.value);
                    }}
                    value={`${c.label} (${c.value})`}
                  >
                    <span className="truncate">{c.label}</span>

                    <HugeIcons
                      aria-hidden="true"
                      className={cn(
                        "ml-auto size-4 shrink-0 text-primary",
                        c.value === value ? "opacity-100" : "opacity-0"
                      )}
                      icon={Tick01Icon}
                    />
                  </CommandItem>
                )}
              </VList>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const FlagComponent = ({ country, countryName }: RpnInput.FlagProps) => {
  const Flag = flags[country];

  return (
    <span className="overflow-hidden text-muted-foreground">
      {Flag ? (
        <Flag title={countryName} />
      ) : (
        <HugeIcons aria-hidden="true" className="size-3.5" icon={Call02Icon} />
      )}
    </span>
  );
};
