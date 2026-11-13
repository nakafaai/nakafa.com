import {
  type ActiveAppLocaleCode,
  ActiveAppLocaleCodeSchema,
} from "@nakafa/aksara-contracts/locale";
import { DropdownMenuItem } from "@repo/design-system/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { languages } from "@repo/internationalization/data/lang";
import { Array as Arr, Option, Schema } from "effect";
import { useId } from "react";
import { useLocale, useTranslations } from "use-intl";
import { ActiveBadge } from "@/components/shared/active";
import {
  CountryFlagIcon,
  type RegionCountryCode,
} from "@/components/shared/flag";
import { useLocalizedRouteSwitch } from "@/lib/routing/locale/client";

/** The languages as a select lists them, so its trigger names the language chosen. */
const languageChoices = Arr.map(languages, ({ label, value }) => ({
  label,
  value,
}));

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

/**
 * A labelled choice of one language in a form, each option with its country's flag and named in itself. Only a
 * served language reaches `onChoose`.
 */
export function LanguageField({
  label,
  onChoose,
  value,
}: {
  label: string;
  onChoose: (locale: ActiveAppLocaleCode) => void;
  value: string | null;
}) {
  const id = useId();
  const common = useTranslations("Common");

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        items={languageChoices}
        onValueChange={(next) => {
          const chosen = Schema.decodeUnknownOption(ActiveAppLocaleCodeSchema)(
            next
          );
          if (Option.isSome(chosen)) {
            onChoose(chosen.value);
          }
        }}
        value={value}
      >
        <SelectTrigger className="w-full" id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent label={common("menu-language")}>
          {Arr.map(languages, (language) => (
            <SelectItem
              icon={
                <CountryFlagIcon
                  countryCode={language.country satisfies RegionCountryCode}
                />
              }
              key={language.value}
              value={language.value}
            >
              {language.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
