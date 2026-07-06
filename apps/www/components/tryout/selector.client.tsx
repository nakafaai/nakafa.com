"use client";

import { api } from "@repo/backend/convex/_generated/api";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@repo/design-system/components/ui/select";
import { normalizeLocalizedInternalHref } from "@repo/internationalization/src/href";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useConvexAuth, useMutation } from "convex/react";
import { Effect } from "effect";
import { useLocale, useTranslations } from "next-intl";
import { CountryFlagIcon } from "@/components/shared/country-flag";
import { saveTryoutPreference } from "@/components/tryout/preference.client";

export type TryoutCountrySelectorOption = Readonly<{
  countryCode: string;
  countryKey: string;
  href: string;
  title: string;
  value: string;
}>;

/** Renders the try-out country selector used by country-level pages. */
export function TryoutCountrySelector({
  currentValue,
  label,
  options,
}: {
  currentValue: string;
  label: string;
  options: readonly TryoutCountrySelectorOption[];
}) {
  const locale = useLocale();
  const router = useRouter();
  const tTryouts = useTranslations("Tryouts");
  const { isAuthenticated, isLoading } = useConvexAuth();
  const setPreferredTryout = useMutation(
    api.learningPreferences.mutations.setPreferredTryoutCountry
  );
  const items = options.map((option) => ({
    label: option.title,
    value: option.value,
  }));
  const currentOption = options.find((option) => option.value === currentValue);

  async function handleValueChange(value: string | null) {
    if (!value || value === currentValue) {
      return;
    }

    const selectedOption = options.find((option) => option.value === value);

    if (!selectedOption) {
      return;
    }

    if (isLoading) {
      return;
    }

    router.push(normalizeLocalizedInternalHref(selectedOption.href));

    if (!isAuthenticated) {
      return;
    }

    await Effect.runPromise(
      saveTryoutPreference({
        countryKey: selectedOption.countryKey,
        errorMessage: tTryouts("preference-save-error"),
        locale,
        setPreferredTryout,
        source: "tryout-country-selector",
      })
    );
  }

  return (
    <Select
      items={items}
      onValueChange={handleValueChange}
      value={currentValue}
    >
      <SelectTrigger
        aria-label={label}
        className="w-full min-w-0 sm:w-auto sm:max-w-[min(32rem,calc(100vw-2rem))]"
        disabled={isLoading}
      >
        <span
          className="flex min-w-0 items-center gap-2"
          data-slot="select-value"
        >
          <CountryFlagIcon countryCode={currentOption?.countryCode} />
          <span className="truncate">{currentOption?.title ?? label}</span>
        </span>
      </SelectTrigger>
      <SelectContent
        align="end"
        alignItemWithTrigger={false}
        className="max-w-(--available-width) sm:w-max sm:min-w-(--anchor-width)"
      >
        <SelectGroup>
          <SelectLabel>{label}</SelectLabel>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <CountryFlagIcon countryCode={option.countryCode} />
              <span className="min-w-0 whitespace-normal leading-snug sm:whitespace-nowrap">
                {option.title}
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
