import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { DropdownMenuItem } from "@repo/design-system/components/ui/dropdown-menu";
import { languages } from "@repo/internationalization/data/lang";
import { Array as Arr } from "effect";
import { useLocale } from "use-intl";
import { ActiveBadge } from "@/components/shared/active";
import type { RegionCountryCode } from "@/components/shared/flag";
import { CountryFlagIcon } from "@/components/shared/flag";
import { useLocalizedRouteSwitch } from "@/lib/routing/locale/client";

/**
 * The languages of a language menu, each with its country's flag and named in itself, the one in use marked. A
 * choice goes to `onPick`, which moves the page or saves the school's language. Each flag's country `satisfies` the
 * bundled flags, so a language whose country has no flag does not compile.
 */
export function LanguageItems({
  disabled = false,
  onPick,
}: {
  disabled?: boolean;
  onPick: (locale: ActiveAppLocaleCode) => void;
}) {
  const current = useLocale();
  return (
    <>
      {Arr.map(languages, (language) => (
        <DropdownMenuItem
          disabled={disabled}
          icon={
            <CountryFlagIcon
              countryCode={language.country satisfies RegionCountryCode}
            />
          }
          key={language.value}
          onClick={(event) => {
            event.stopPropagation();
            onPick(language.value);
          }}
        >
          <span className="truncate">{language.label}</span>
          <ActiveBadge isActive={current === language.value} />
        </DropdownMenuItem>
      ))}
    </>
  );
}

/** The language menu of a page: a choice moves the page to that language's address, and the menu waits while it moves. */
export function RouteLanguageItems() {
  const { isPending, replace } = useLocalizedRouteSwitch();
  return <LanguageItems disabled={isPending} onPick={replace} />;
}
