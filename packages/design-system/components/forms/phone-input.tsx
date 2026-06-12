"use client";

import {
  Call02Icon,
  ChevronsDownUpIcon,
  Search02Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/icons/huge-icons";
import {
  Autocomplete,
  AutocompleteEmpty,
  AutocompleteGroup,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
} from "@repo/design-system/components/ui/autocomplete";
import { Button } from "@repo/design-system/components/ui/button";
import { groupVariants } from "@repo/design-system/components/ui/group";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Popover,
  PopoverPopup,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";
import type React from "react";
import { useMemo, useState } from "react";
import * as RpnInput from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import { VList } from "virtua";

const countrySearchIcon = <HugeIcons icon={Search02Icon} />;

type PhoneInputProps = {
  className?: string;
} & React.ComponentProps<typeof RpnInput.default>;

export default function PhoneInput({ className, ...props }: PhoneInputProps) {
  return (
    <div className={cn("*:not-first:mt-2", className)} dir="ltr">
      <RpnInput.default
        className={cn(groupVariants(), "w-full")}
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
  return <Input className={className} data-slot="phone-input" {...props} />;
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
      <PopoverTrigger render={<Button type="button" variant="outline" />}>
        <FlagComponent aria-hidden="true" country={value} countryName={value} />
        <span className="text-muted-foreground">
          <HugeIcons
            aria-hidden="true"
            className="ml-auto"
            icon={ChevronsDownUpIcon}
          />
        </span>
      </PopoverTrigger>
      <PopoverPopup align="start" className="w-80 p-0">
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
                    className="justify-between gap-2"
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
                        "ml-auto text-primary",
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
      </PopoverPopup>
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
