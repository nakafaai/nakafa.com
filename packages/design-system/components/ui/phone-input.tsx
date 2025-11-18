"use client";

import { cn } from "@repo/design-system/lib/utils";
import { CheckIcon, ChevronDownIcon, PhoneIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type React from "react";
import { useId, useMemo, useState } from "react";
import * as RpnInput from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import { VList } from "virtua";
import { Button } from "./button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

type PhoneInputProps = {
  placeholder: string;
  value?: string;
  onChangeAction?: (value: string) => void;
  className?: string;
};

export default function PhoneInput({
  placeholder,
  value,
  onChangeAction,
  className,
  ...props
}: PhoneInputProps) {
  const id = useId();

  return (
    <div className={cn("*:not-first:mt-2", className)} dir="ltr">
      <RpnInput.default
        className="flex shadow-xs"
        countrySelectComponent={CountrySelect}
        defaultCountry="ID"
        flagComponent={FlagComponent}
        id={id}
        inputComponent={Phone}
        international
        onChange={(newValue) => onChangeAction?.(newValue ?? "")}
        placeholder={placeholder}
        value={value}
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

type CountrySelectProps = {
  disabled?: boolean;
  value: RpnInput.Country;
  onChange: (value: RpnInput.Country) => void;
  options: { label: string; value: RpnInput.Country | undefined }[];
};

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
            <ChevronDownIcon
              aria-hidden="true"
              className="ml-auto h-4 w-4 shrink-0 opacity-50"
            />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-full border-input p-0">
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

                    <CheckIcon
                      className={cn(
                        "ml-auto size-4 shrink-0 text-primary",
                        c.value === value ? "opacity-100" : "opacity-0"
                      )}
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
        <PhoneIcon aria-hidden="true" className="size-3.5" />
      )}
    </span>
  );
};
