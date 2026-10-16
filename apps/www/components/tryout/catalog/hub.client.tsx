"use client";

import type { Ref } from "@confect/core";

import type tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { IntentLink } from "@repo/design-system/components/ui/intent-link";
import { getTileShifts } from "@repo/design-system/lib/look";
import { Array as Arr, Effect, Predicate } from "effect";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { useConvexAuth } from "@/components/providers/convex";
import {
  CatalogCard,
  CatalogCardImage,
  CatalogCardTile,
} from "@/components/shared/catalog/card";
import { CountryFlagIcon } from "@/components/shared/flag";
import { ComingSoon } from "@/components/shared/upcoming";
import { saveTryoutPreference } from "@/components/tryout/catalog/preference.client";
import { getTryoutPublicPathHref } from "@/components/tryout/route/path";
import { getTryoutCountryCatalogArtwork } from "@/lib/tryout/artwork";
import { useSetPreferredTryoutMutation } from "@/lib/tryout/mutation.client";

interface TryoutHubClientProps {
  locale: Locale;
  page: {
    readonly countries: Ref.Returns<
      typeof tryouts.queries.catalog.getHubPage
    >["countries"];
  };
}

type HubCountry = Ref.Returns<
  typeof tryouts.queries.catalog.getHubPage
>["countries"][number];

/** Renders the realtime country-first try-out hub from Convex. */
export function TryoutHubClient({ locale, page }: TryoutHubClientProps) {
  const tTryouts = useTranslations("Tryouts");
  const tToast = useTranslations("Toast");
  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  const isLoading = useConvexAuth((auth) => auth.isLoading);
  const setPreferredTryout = useSetPreferredTryoutMutation(page.countries);

  if (!page) {
    return null;
  }

  if (page.countries.length === 0) {
    return <ComingSoon />;
  }

  /** Persist an authenticated viewer's selected country in the background. */
  function handleCountryClick(country: HubCountry) {
    if (isLoading || !isAuthenticated) {
      return;
    }

    Effect.runPromise(
      saveTryoutPreference({
        countryKey: country.countryKey,
        errorMessage: {
          title: tToast("tryout-preference-error.title"),
        },
        locale,
        setPreferredTryout,
        source: "tryout-country-card",
      })
    ).then(() => undefined);
  }

  const visuals = getTileShifts(
    Arr.map(page.countries, (country) => {
      const imageSrc = getTryoutCountryCatalogArtwork(locale, {
        countryKey: country.countryKey,
      });

      return imageSrc === undefined ? country.countryKey : { imageSrc };
    })
  );

  return (
    <div className="grid grid-cols-1 gap-4 pt-6 pb-24 sm:grid-cols-2">
      {Arr.map(Arr.zip(page.countries, visuals), ([country, visual], index) => (
        <CatalogCard
          action={
            <IntentLink
              href={getTryoutPublicPathHref(country.publicPath)}
              onClick={() => handleCountryClick(country)}
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
