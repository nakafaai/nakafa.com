"use client";

import { api } from "@repo/backend/convex/_generated/api";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import {
  ChoiceCardContent,
  choiceCardVariants,
} from "@/components/shared/choice/card";
import { ChoiceCardVisual } from "@/components/shared/choice/visual";
import { ComingSoon } from "@/components/shared/coming-soon";
import { CountryFlagIcon } from "@/components/shared/country-flag";
import { saveTryoutPreference } from "@/components/tryout/catalog/preference.client";
import { getTryoutPublicPathHref } from "@/components/tryout/route/path";

interface TryoutHubClientProps {
  locale: Locale;
}

type HubCountry = FunctionReturnType<
  typeof api.tryouts.queries.catalog.getHubPage
>["countries"][number];

/** Renders the realtime country-first try-out hub from Convex. */
export function TryoutHubClient({ locale }: TryoutHubClientProps) {
  const page = useQuery(api.tryouts.queries.catalog.getHubPage, { locale });
  const tTryouts = useTranslations("Tryouts");
  const { isAuthenticated, isLoading } = useConvexAuth();
  const setPreferredTryout = useMutation(
    api.learningPreferences.mutations.setPreferredTryoutCountry
  );

  if (!page) {
    return null;
  }

  if (page.countries.length === 0) {
    return <ComingSoon />;
  }

  function handleCountryClick(country: HubCountry) {
    if (isLoading || !isAuthenticated) {
      return;
    }

    Effect.runPromise(
      saveTryoutPreference({
        countryKey: country.countryKey,
        errorMessage: tTryouts("preference-save-error"),
        locale,
        setPreferredTryout,
        source: "tryout-country-card",
      })
    ).then(() => undefined);
  }

  return (
    <div className="grid grid-cols-2 gap-4 pt-6 pb-24 md:grid-cols-3">
      {page.countries.map((country) => (
        <NavigationLink
          className={choiceCardVariants()}
          href={getTryoutPublicPathHref(country.publicPath)}
          key={country.countryKey}
          onClick={() => handleCountryClick(country)}
        >
          <ChoiceCardVisual seed={country.publicPath}>
            <CountryFlagIcon
              className="relative h-6 w-9 rounded-[2px] ring-1 ring-border/60"
              countryCode={country.countryCode}
            />
          </ChoiceCardVisual>
          <ChoiceCardContent>
            <h2>{country.title}</h2>
          </ChoiceCardContent>
        </NavigationLink>
      ))}
    </div>
  );
}
