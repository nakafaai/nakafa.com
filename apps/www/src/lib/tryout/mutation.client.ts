"use client";

import { useMutation } from "@confect/react";
import learningPreferences from "@repo/backend/confect/_generated/refs/learningPreferences";
import { Array as Arr, Option } from "effect";
import type { TryoutCountrySelectorOption } from "@/components/tryout/catalog/options";

type TryoutPreferenceOption = Pick<
  TryoutCountrySelectorOption,
  "countryCode" | "countryKey" | "publicPath" | "title"
>;

/** Return a try-out mutation that updates the matching localized preference. */
export function useSetPreferredTryoutMutation(
  countries: readonly TryoutPreferenceOption[]
) {
  return useMutation(
    learningPreferences.mutations.setPreferredTryoutCountry
  ).withOptimisticUpdate(
    (localStore, { locale, preferredTryoutCountryKey }) => {
      const match = Arr.findFirst(
        countries,
        (candidate) => candidate.countryKey === preferredTryoutCountryKey
      );
      if (Option.isNone(match)) {
        return;
      }
      const country = match.value;
      const current = Option.getOrUndefined(
        localStore.getQuery(learningPreferences.queries.getCurrentTryout, {
          locale,
        })
      );
      if (current === undefined) {
        return;
      }
      localStore.setQuery(
        learningPreferences.queries.getCurrentTryout,
        {
          locale,
        },
        Option.some({
          country: {
            countryCode: country.countryCode,
            key: country.countryKey,
            publicPath: country.publicPath,
            title: country.title,
          },
          preferredTryoutCountryKey,
        })
      );
    }
  );
}
