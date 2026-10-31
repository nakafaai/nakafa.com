import type { Ref } from "@confect/core";

import type tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { getTileShifts } from "@repo/design-system/lib/look";
import { Array as Arr, Effect, Predicate } from "effect";
import { type RefObject, useEffect, useRef } from "react";
import { useLocale, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { ConvexIsland } from "@/components/providers/island";
import {
  CatalogCard,
  CatalogCardTile,
  CatalogCardVisual,
} from "@/components/shared/catalog/card";
import { CatalogActionLabelContext } from "@/components/shared/catalog/label";
import { CountryFlagIcon } from "@/components/shared/flag";
import { ComingSoon } from "@/components/shared/upcoming";
import { saveTryoutPreference } from "@/components/tryout/catalog/preference";
import { TryoutPageLink } from "@/components/tryout/route/link";
import { getTryoutCountryCatalogArtwork } from "@/lib/tryout/artwork";
import { useSetPreferredTryoutMutation } from "@/lib/tryout/mutation";

interface TryoutHubClientProps {
  page: {
    readonly countries: Ref.Returns<
      typeof tryouts.queries.catalog.getHubPage
    >["countries"];
  };
}

type HubCountries = TryoutHubClientProps["page"]["countries"];

type HubCountry = HubCountries[number];

/**
 * Renders the country-first try-out hub. The cards are the same for a visitor and a learner, so they stand
 * outside the page's live client and never redraw when it arrives. A learner's pick also saves the chosen
 * country, through the part that mounts only once the page holds a client.
 */
export function TryoutHubClient({ page }: TryoutHubClientProps) {
  const savePick = useRef<((country: HubCountry) => void) | null>(null);

  if (page.countries.length === 0) {
    return <ComingSoon />;
  }

  return (
    <>
      <TryoutHubCountries
        countries={page.countries}
        onPick={(country) => savePick.current?.(country)}
      />
      <ConvexIsland>
        <TryoutHubPreference countries={page.countries} savePick={savePick} />
      </ConvexIsland>
    </>
  );
}

/** Saves a learner's pick as their choice, once the learner is signed in. It draws nothing. */
function TryoutHubPreference({
  countries,
  savePick,
}: {
  countries: HubCountries;
  savePick: RefObject<((country: HubCountry) => void) | null>;
}) {
  const locale = useLocale();
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

  useEffect(() => {
    savePick.current = handleCountryClick;
    return () => {
      savePick.current = null;
    };
  });

  return null;
}

/** The country cards of the hub. A card reports its pick only when the page passes `onPick`. */
function TryoutHubCountries({
  countries,
  onPick,
}: {
  countries: HubCountries;
  onPick?: (country: HubCountry) => void;
}) {
  const locale = useLocale();
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
    <CatalogActionLabelContext value={tTryouts("open-country-cta")}>
      <div className="grid grid-cols-1 gap-4 pt-6 pb-24 sm:grid-cols-2">
        {Arr.map(Arr.zip(countries, visuals), ([country, visual], index) => (
          <CatalogCard
            action={(anchor) => (
              <TryoutPageLink
                {...anchor}
                onClick={
                  onPick === undefined ? undefined : () => onPick(country)
                }
                publicPath={country.publicPath}
              />
            )}
            key={country.countryKey}
            title={country.title}
          >
            {Predicate.isNumber(visual) ? (
              <CatalogCardTile seed={country.countryKey} shift={visual}>
                <CountryFlagIcon
                  className="ring-border/60 h-6 w-9 rounded-xs ring-1"
                  countryCode={country.countryCode}
                />
              </CatalogCardTile>
            ) : (
              <CatalogCardVisual
                preload={index === 0}
                visual={visual.imageSrc}
              />
            )}
          </CatalogCard>
        ))}
      </div>
    </CatalogActionLabelContext>
  );
}
