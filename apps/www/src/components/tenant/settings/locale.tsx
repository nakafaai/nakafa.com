import { useMutation } from "@confect/react";
import { CountryCodeSchema } from "@nakafa/aksara-contracts/country";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { NewCurrency } from "@repo/backend/confect/tenancy/locale";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import {
  countryDefaults,
  StartCountry,
} from "@repo/backend/confect/tenancy/start";
import { Button } from "@repo/design-system/components/ui/button";
import { CardContent } from "@repo/design-system/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Array as Arr, Option, Record as Rec, Schema } from "effect";
import { startTransition, useId, useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
} from "@/components/shared/card/section";
import { setLocaleChange } from "@/components/tenant/settings/edits";
import { saveSchool } from "@/components/tenant/settings/save";

const SOURCE = "components/tenant/settings/locale";

/** The countries a school may name, with the one it holds when its contract opened it elsewhere. */
const countriesWith = (held: string) =>
  Arr.dedupe(Arr.append(StartCountry.literals, held));

/** The currencies of those countries, with the one the school holds. */
const currenciesWith = (held: string) =>
  Arr.dedupe(
    Arr.append(
      Arr.map(Rec.values(countryDefaults), (country) => country.currency),
      held
    )
  );

/**
 * The school's country and contract currency, which its Owner and its Admin change. A country that
 * the school can open in brings its own currency, and the currency may then differ from it. A save
 * shows at once, and a refusal steps it back.
 */
export function SchoolLocaleCard({
  country,
  currency,
  slug,
}: {
  country: string;
  currency: string;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const locale = useLocale();
  const id = useId();
  const setLocale = useMutation(
    tenancy.settings.setLocale
  ).withOptimisticUpdate(setLocaleChange);
  const [nextCountry, setNextCountry] = useState(country);
  const [nextCurrency, setNextCurrency] = useState(currency);
  const countryNames = new Intl.DisplayNames([locale], { type: "region" });
  const currencyNames = new Intl.DisplayNames([locale], { type: "currency" });
  const countryItems = Arr.map(countriesWith(country), (value) => ({
    label: countryNames.of(value) ?? value,
    value,
  }));
  const currencyItems = Arr.map(currenciesWith(currency), (value) => ({
    label: `${value}, ${currencyNames.of(value) ?? value}`,
    value,
  }));
  const changed = nextCountry !== country || nextCurrency !== currency;

  const save = () => {
    const decodedCountry = Schema.decodeOption(CountryCodeSchema)(nextCountry);
    const decodedCurrency = Schema.decodeOption(NewCurrency)(nextCurrency);
    if (Option.isNone(decodedCountry) || Option.isNone(decodedCurrency)) {
      return;
    }
    startTransition(() =>
      saveSchool(
        () =>
          setLocale({
            country: decodedCountry.value,
            currency: decodedCurrency.value,
            slug,
          }),
        SOURCE
      )
    );
  };

  return (
    <CardSection
      description={t("locale-description")}
      title={t("locale-title")}
    >
      <CardContent>
        <FieldGroup className="max-w-sm">
          <Field>
            <FieldLabel htmlFor={`${id}-country`}>
              {t("locale-country")}
            </FieldLabel>
            <Select
              items={countryItems}
              onValueChange={(value) => {
                if (typeof value !== "string") {
                  return;
                }
                setNextCountry(value);
                if (Schema.is(StartCountry)(value)) {
                  setNextCurrency(countryDefaults[value].currency);
                }
              }}
              value={nextCountry}
            >
              <SelectTrigger className="w-full" id={`${id}-country`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {Arr.map(countryItems, (item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-currency`}>
              {t("locale-currency")}
            </FieldLabel>
            <Select
              items={currencyItems}
              onValueChange={(value) => {
                if (typeof value === "string") {
                  setNextCurrency(value);
                }
              }}
              value={nextCurrency}
            >
              <SelectTrigger className="w-full" id={`${id}-currency`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {Arr.map(currencyItems, (item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>
      </CardContent>
      <CardSectionFooter hint={t("locale-footer")}>
        <CardSectionActions>
          <Button disabled={!changed} onClick={save} type="button">
            {t("save")}
          </Button>
        </CardSectionActions>
      </CardSectionFooter>
    </CardSection>
  );
}
