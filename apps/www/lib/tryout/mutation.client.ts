"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { useMutation } from "convex/react";

export interface TryoutPreferenceOption {
  countryCode: string;
  countryKey: string;
  publicPath: string;
  title: string;
}

/** Return a try-out mutation that updates the matching localized preference. */
export function useSetPreferredTryoutMutation(
  countries: readonly TryoutPreferenceOption[]
) {
  return useMutation(
    api.learningPreferences.mutations.setPreferredTryoutCountry
  ).withOptimisticUpdate(
    (localStore, { locale, preferredTryoutCountryKey }) => {
      const country = countries.find(
        (candidate) => candidate.countryKey === preferredTryoutCountryKey
      );
      if (!country) {
        return;
      }

      const current = localStore.getQuery(
        api.learningPreferences.queries.getCurrentTryout,
        { locale }
      );
      if (current === undefined) {
        return;
      }

      localStore.setQuery(
        api.learningPreferences.queries.getCurrentTryout,
        { locale },
        {
          country: {
            countryCode: country.countryCode,
            key: country.countryKey,
            publicPath: country.publicPath,
            title: country.title,
          },
          preferredTryoutCountryKey,
        }
      );
    }
  );
}
