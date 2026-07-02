"use client";

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
import GB from "country-flag-icons/react/3x2/GB";
import ID from "country-flag-icons/react/3x2/ID";
import SG from "country-flag-icons/react/3x2/SG";
import US from "country-flag-icons/react/3x2/US";

export type CurriculumSelectorOption = Readonly<{
  countryCode?: string;
  href: string;
  title: string;
  value: string;
}>;

/** Renders the root curriculum selector and navigates to the selected root. */
export function CurriculumSelector({
  currentValue,
  label,
  options,
}: {
  currentValue: string;
  label: string;
  options: readonly CurriculumSelectorOption[];
}) {
  const router = useRouter();
  const items = options.map((option) => ({
    label: option.title,
    value: option.value,
  }));
  const currentOption = options.find((option) => option.value === currentValue);

  function handleValueChange(value: string | null) {
    if (!value || value === currentValue) {
      return;
    }

    const selectedOption = options.find((option) => option.value === value);

    if (!selectedOption) {
      return;
    }

    router.push(normalizeLocalizedInternalHref(selectedOption.href));
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
        className="sm:w-max sm:max-w-[min(28rem,calc(100vw-2rem))]"
      >
        <SelectGroup>
          <SelectLabel>{label}</SelectLabel>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <CountryFlagIcon countryCode={option.countryCode} />
              <span className="min-w-0 truncate">{option.title}</span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

/** Renders one supported provider country flag without creating dynamic components during render. */
function CountryFlagIcon({ countryCode }: { countryCode?: string }) {
  switch (countryCode) {
    case "GB":
      return <GB className="size-4 shrink-0" />;
    case "ID":
      return <ID className="size-4 shrink-0" />;
    case "SG":
      return <SG className="size-4 shrink-0" />;
    case "US":
      return <US className="size-4 shrink-0" />;
    default:
      return null;
  }
}
