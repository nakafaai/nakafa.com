import { QueryResult } from "@confect/react";
import { SchoolIcon } from "@hugeicons/core-free-icons";
import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { UnitLevel } from "@repo/backend/confect/tenancy/schema";
import { StartCountry } from "@repo/backend/confect/tenancy/start";
import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Array as Arr, Option, Schema } from "effect";
import { useTranslations } from "use-intl";
import { CountryFlagIcon } from "@/components/shared/flag";
import { useViewerQuery } from "@/components/tenant/context";
import { languageItems } from "@/components/tenant/settings/choices";
import { levelsOf } from "@/components/tenant/start/state";

/** One level of a school, as the unit schema names it. */
type Level = typeof UnitLevel.Type;

/**
 * The levels a school may take in its country: the levels the questionnaire offers there, and
 * every level for a country the questionnaire does not open a school in.
 */
const levelsIn = (country: string): readonly Level[] =>
  Schema.is(StartCountry)(country) ? levelsOf(country) : UnitLevel.literals;

/** The name of a school, as the dialogs that add and edit one ask for it. */
export function UnitNameField({
  id,
  onChange,
  value,
}: {
  id: string;
  onChange: (name: string) => void;
  value: string;
}) {
  const t = useTranslations("SchoolSettings");

  return (
    <Field>
      <FieldLabel htmlFor={id}>{t("unit-add-name")}</FieldLabel>
      <Input
        id={id}
        maxLength={160}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("unit-add-name-placeholder")}
        value={value}
      />
    </Field>
  );
}

/**
 * The level of a school, from the levels the organisation's country offers, each named as the
 * questionnaire names it there. A level the country does not offer, which a school can hold from
 * before, stays at the end of the list, so the field still shows it. The country comes with the
 * viewer the School page loads with; until the viewer is read, which a settings dialog never
 * opens before, every level is offered under its generic name.
 */
export function UnitLevelField({
  id,
  onChange,
  value,
}: {
  id: string;
  onChange: (level: Level) => void;
  value: Level;
}) {
  const common = useTranslations("Common");
  const t = useTranslations("SchoolSettings");
  const start = useTranslations("SchoolStart");
  const viewer = useViewerQuery();
  const country = QueryResult.isSuccess(viewer)
    ? Option.some(viewer.value.tenant.country)
    : Option.none();
  const offered = Option.match(country, {
    onNone: () => UnitLevel.literals,
    onSome: levelsIn,
  });
  const levels = Arr.contains(offered, value)
    ? offered
    : Arr.append(offered, value);
  const items = Arr.map(levels, (level) => ({
    label: Option.contains(country, "ID")
      ? start(`level.${level}.title`)
      : start(`stage.${level}`),
    value: level,
  }));

  return (
    <Field>
      <FieldLabel htmlFor={id}>{t("unit-add-level")}</FieldLabel>
      <Select
        items={items}
        onValueChange={(next) => {
          const level = Schema.decodeUnknownOption(UnitLevel)(next);
          if (Option.isSome(level)) {
            onChange(level.value);
          }
        }}
        value={value}
      >
        <SelectTrigger className="w-full" id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent label={common("menu-level")}>
          {Arr.map(items, (item) => (
            <SelectItem icon={SchoolIcon} key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

/** The language of a unit's pages, each language with its flag, as the dialogs that add and edit a unit ask for it. */
export function UnitLanguageField({
  id,
  onChange,
  value,
}: {
  id: string;
  onChange: (language: typeof ActiveAppLocaleCodeSchema.Type) => void;
  value: typeof ActiveAppLocaleCodeSchema.Type | null;
}) {
  const common = useTranslations("Common");
  const t = useTranslations("SchoolSettings");

  return (
    <Field>
      <FieldLabel htmlFor={id}>{t("unit-page-language")}</FieldLabel>
      <Select
        items={languageItems}
        onValueChange={(next) => {
          const chosen = Schema.decodeUnknownOption(ActiveAppLocaleCodeSchema)(
            next
          );
          if (Option.isSome(chosen)) {
            onChange(chosen.value);
          }
        }}
        value={value}
      >
        <SelectTrigger className="w-full" id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent label={common("menu-language")}>
          {Arr.map(languageItems, (item) => (
            <SelectItem
              icon={<CountryFlagIcon countryCode={item.countryCode} />}
              key={item.value}
              value={item.value}
            >
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
