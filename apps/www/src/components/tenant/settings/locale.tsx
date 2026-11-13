import { useMutation } from "@confect/react";
import { CountryCodeSchema } from "@nakafa/aksara-contracts/country";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { countryProfiles } from "@repo/backend/confect/country/registry";
import { NewCurrency } from "@repo/backend/confect/tenancy/locale";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { StartCountry } from "@repo/backend/confect/tenancy/start";
import { Button } from "@repo/design-system/components/ui/button";
import { CardContent } from "@repo/design-system/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { currencySymbol } from "@repo/internationalization/src/money";
import { Array as Arr, Option, Schema } from "effect";
import { startTransition, useId, useMemo, useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
} from "@/components/shared/card/section";
import { countryChoices } from "@/components/tenant/settings/choices";
import { setLocaleChange } from "@/components/tenant/settings/edits";
import { RegionPicker } from "@/components/tenant/settings/picker";
import { runSchoolWrite, schoolCall } from "@/components/tenant/write";

/** Every currency the platform knows, with its name and the symbol it writes in the viewer's language, by code. */
function currencyChoices(locale: string) {
  const names = new Intl.DisplayNames([locale], { type: "currency" });
  return Arr.map(Intl.supportedValuesOf("currency"), (code) => ({
    label: names.of(code) ?? code,
    symbol: currencySymbol(code, locale),
    value: code,
  }));
}

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
  // The fields hold what the admin chose, and the school's own values until they choose, so a page drawn from an
  // older read shows the live value once it arrives.
  const [chosenCountry, setNextCountry] = useState<string | null>(null);
  const [chosenCurrency, setNextCurrency] = useState<string | null>(null);
  const nextCountry = chosenCountry ?? country;
  const nextCurrency = chosenCurrency ?? currency;
  const countryItems = useMemo(() => countryChoices(locale), [locale]);
  const currencyItems = useMemo(() => currencyChoices(locale), [locale]);
  const changed = nextCountry !== country || nextCurrency !== currency;

  const save = () => {
    const decodedCountry = Schema.decodeOption(CountryCodeSchema)(nextCountry);
    const decodedCurrency = Schema.decodeOption(NewCurrency)(nextCurrency);
    if (Option.isNone(decodedCountry) || Option.isNone(decodedCurrency)) {
      return;
    }
    startTransition(() =>
      runSchoolWrite(
        schoolCall(() =>
          setLocale({
            country: decodedCountry.value,
            currency: decodedCurrency.value,
            slug,
          })
        )
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
            <RegionPicker
              choices={countryItems}
              id={`${id}-country`}
              kind="country"
              onChoose={(value) => {
                setNextCountry(value);
                if (Schema.is(StartCountry)(value)) {
                  setNextCurrency(countryProfiles[value].currency);
                }
              }}
              value={nextCountry}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-currency`}>
              {t("locale-currency")}
            </FieldLabel>
            <RegionPicker
              choices={currencyItems}
              id={`${id}-currency`}
              kind="currency"
              onChoose={setNextCurrency}
              value={nextCurrency}
            />
          </Field>
        </FieldGroup>
      </CardContent>
      <CardSectionFooter hint={t("locale-footer")}>
        <CardSectionActions>
          <Button
            disabled={!changed}
            onClick={save}
            type="button"
            variant="outline"
          >
            {t("save")}
          </Button>
        </CardSectionActions>
      </CardSectionFooter>
    </CardSection>
  );
}
