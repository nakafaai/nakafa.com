import type { Ref } from "@confect/core";

import type tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { IntentLink } from "@repo/design-system/components/ui/intent-link";
import { getTileShifts } from "@repo/design-system/lib/look";
import { Array as Arr, Effect, Predicate } from "effect";
import type { Locale } from "use-intl";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { ConvexIsland } from "@/components/providers/island";
import {
  CatalogCard,
  CatalogCardImage,
  CatalogCardTile,
} from "@/components/shared/catalog/card";
import { CountryFlagIcon } from "@/components/shared/flag";
import { ComingSoon } from "@/components/shared/upcoming";
import { saveTryoutPreference } from "@/components/tryout/catalog/preference";
import { getTryoutPublicPathHref } from "@/components/tryout/route/path";
import { getTryoutCountryCatalogArtwork } from "@/lib/tryout/artwork";
import { useSetPreferredTryoutMutation } from "@/lib/tryout/mutation";

interface TryoutHubClientProps {
  locale: Locale;
  page: {
    readonly countries: Ref.Returns<
      typeof tryouts.queries.catalog.getHubPage
    >["countries"];
  };
}

type HubCountries = TryoutHubClientProps["page"]["countries"];

type HubCountry = HubCountries[number];

/**
 * Renders the country-first try-out hub. A visitor's country cards only link. A
 * learner's cards also save the chosen country through the page's live client,
 * which mounts only once the page holds one.
 */
export function TryoutHubClient({ locale, page }: TryoutHubClientProps) {
  if (page.countries.length === 0) {
    return <ComingSoon />;
  }

  return (
    <ConvexIsland
      fallback={
        <TryoutHubCountries countries={page.countries} locale={locale} />
      }
    >
      <TryoutHubSignedCountries countries={page.countries} locale={locale} />
    </ConvexIsland>
  );
}

/** A learner's country cards: a click saves the country as the learner's choice, once the learner is signed in. */
function TryoutHubSignedCountries({
  countries,
  locale,
}: {
  countries: HubCountries;
  locale: Locale;
}) {
  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  const isLoading = useConvexAuth((auth) => auth.isLoading);
  const setPreferredTryout = useSetPreferredTryoutMutation(countries);

  /** Persist an authenticated viewer's selected country in the background. */
  function handleCountryClick(country: HubCountry) {
    if (isLoading || !isAuthenticated) {
      return;
    }

    Effect.runPromise(
      saveTryoutPreference({
        countryKey: country.countryKey,
        errorMessage: {
          title: "tryout-preference-error.title",
        },
        locale,
        setPreferredTryout,
        source: "tryout-country-card",
      })
    ).then(() => undefined);
  }

  return (
    <TryoutHubCountries
      countries={countries}
      locale={locale}
      onPick={handleCountryClick}
    />
  );
}

/** The country cards of the hub. A card reports its pick only when the page passes `onPick`. */
function TryoutHubCountries({
  countries,
  locale,
  onPick,
}: {
  countries: HubCountries;
  locale: Locale;
  onPick?: (country: HubCountry) => void;
}) {
  const tTryouts = useTranslations("Tryouts");
  const visuals = getTileShifts(
    Arr.map(countries, (country) => {
      const imageSrc = getTryoutCountryCatalogArtwork(locale, {
        countryKey: country.countryKey,
      });

      return imageSrc === undefined ? country.countryKey : { imageSrc };
    })
  );

  return (
    <div className="grid grid-cols-1 gap-4 pt-6 pb-24 sm:grid-cols-2">
      {Arr.map(Arr.zip(countries, visuals), ([country, visual], index) => (
        <CatalogCard
          action={
            <IntentLink
              href={getTryoutPublicPathHref(country.publicPath)}
              onClick={onPick === undefined ? undefined : () => onPick(country)}
            />
          }
          actionLabel={tTryouts("open-country-cta")}
          key={country.countryKey}
          title={country.title}
        >
          {Predicate.isNumber(visual) ? (
            <CatalogCardTile seed={country.countryKey} shift={visual}>
              <CountryFlagIcon
                className="h-6 w-9 rounded-xs ring-1 ring-border/60"
                countryCode={country.countryCode}
              />
            </CatalogCardTile>
          ) : (
            <CatalogCardImage preload={index === 0} src={visual.imageSrc} />
          )}
        </CatalogCard>
      ))}
    </div>
  );
}
