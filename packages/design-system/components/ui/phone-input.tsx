"use client";

import {
  ArrowDown01Icon,
  Call02Icon,
  Search02Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import {
  Autocomplete,
  AutocompleteEmpty,
  AutocompleteGroup,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
} from "@repo/design-system/components/ui/autocomplete";
import { Button } from "@repo/design-system/components/ui/button";
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

const countrySearchIcon = <HugeIcons className="size-4" icon={Search02Icon} />;

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

interface CountryOption {
  label: string;
  value: RpnInput.Country;
}

function hasCountryValue(
  option: CountrySelectProps["options"][number]
): option is CountryOption {
  return option.value !== undefined;
}

const CountrySelect = ({ value, onChange, options }: CountrySelectProps) => {
  const t = useTranslations("Common");

  const [searchQuery, setSearchQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filteredCountries = useMemo(() => {
    const validOptions = options.filter(hasCountryValue);

    let filtered = validOptions;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = validOptions.filter(
        (c) =>
          c.label.toLowerCase().includes(q) || c.value.toLowerCase().includes(q)
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
      <PopoverTrigger
        render={
          <Button
            className="inline-flex items-center rounded-r-none border px-3 hover:bg-accent hover:text-accent-foreground"
            variant="ghost"
          />
        }
      >
        <FlagComponent aria-hidden="true" country={value} countryName={value} />
        <span className="text-muted-foreground">
          <HugeIcons
            aria-hidden="true"
            className="ml-auto h-4 w-4 shrink-0 opacity-50"
            icon={ArrowDown01Icon}
          />
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-full border-[color-mix(in_oklch,var(--input)_5%,var(--border))] p-0"
      >
        <Autocomplete
          autoHighlight="always"
          filter={null}
          inline
          items={filteredCountries}
          itemToStringValue={(country) => `${country.label} (${country.value})`}
          keepHighlight
          mode="none"
          onValueChange={setSearchQuery}
          open
          value={searchQuery}
        >
          <AutocompleteInput
            className="h-9 rounded-none border-x-0 border-t-0 border-b shadow-none focus-visible:border-border focus-visible:ring-0"
            placeholder={t("search-country-placeholder")}
            showClear
            startAddon={countrySearchIcon}
          />
          <AutocompleteEmpty>{t("no-country-found")}</AutocompleteEmpty>
          <AutocompleteList className="p-0" scrollArea={false}>
            <AutocompleteGroup
              className={cn("p-0", filteredCountries.length === 0 && "hidden")}
              items={filteredCountries}
            >
              <VList
                className="p-1"
                data={filteredCountries}
                style={{ height: "200px" }}
              >
                {(c) => (
                  <AutocompleteItem
                    className="flex min-h-8 cursor-pointer items-center justify-between gap-2 py-1.5 text-sm sm:min-h-8"
                    key={c.value}
                    onClick={() => {
                      onChange(c.value);
                      setOpen(false);
                      setSearchQuery("");
                    }}
                    value={c}
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
                  </AutocompleteItem>
                )}
              </VList>
            </AutocompleteGroup>
          </AutocompleteList>
        </Autocomplete>
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
