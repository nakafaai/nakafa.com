import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
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
import { useTranslations } from "use-intl";
import type { RegionCountryCode } from "@/components/shared/flag";
import { CountryFlagIcon } from "@/components/shared/flag";

/** The languages as a select lists them, so its trigger names the language chosen. */
const languageChoices = Arr.map(languages, ({ label, value }) => ({
  label,
  value,
}));

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
