import type { Ref } from "@confect/core";

import type tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { getTileLooks } from "@repo/design-system/lib/look";
import { Array as Arr, Effect, Schema, Tuple } from "effect";
import { type RefObject, useImperativeHandle, useRef } from "react";
import { useLocale, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { ConvexIsland } from "@/components/providers/island";
import {
  CatalogCard,
  CatalogCardVisual,
} from "@/components/shared/catalog/card";
import { CatalogActionLabelContext } from "@/components/shared/catalog/label";
import { CountryFlagIcon } from "@/components/shared/flag";
import { ComingSoon } from "@/components/shared/upcoming";
import { getTryoutExamIcons } from "@/components/tryout/catalog/icons";
import { saveTryoutPreference } from "@/components/tryout/catalog/preference";
import { TryoutPageLink } from "@/components/tryout/route/link";
import { useSetPreferredTryoutMutation } from "@/lib/tryout/mutation";

type HubPageCountry = Ref.Returns<
  typeof tryouts.queries.catalog.getHubPage
>["countries"][number];

/** The card artwork the server found for an exam, when the catalog names one. */
const ExamCardImageSchema = Schema.Struct({
  imageSrc: Schema.optionalKey(Schema.String),
});

/** One exam card of the hub, with its artwork. */
type HubExam = HubPageCountry["exams"][number] &
  typeof ExamCardImageSchema.Type;

/** One country of the hub, its exams carrying their card artwork. */
type HubCountry = Omit<HubPageCountry, "exams"> &
  Record<"exams", readonly HubExam[]>;

type HubCountries = readonly HubCountry[];

interface TryoutHubClientProps {
  page: { readonly countries: HubCountries };
}

/**
 * Renders the try-out hub: every exam under its country. The cards are the same for a visitor and a learner,
 * so they stand outside the page's live client and never redraw when it arrives. A learner's pick also saves
 * the exam's country, through the part that mounts only once the page holds a client.
 */
export function TryoutHubClient({ page }: TryoutHubClientProps) {
  const savePick = useRef<((country: HubCountry) => void) | null>(null);
  const tTryouts = useTranslations("Tryouts");

  if (page.countries.length === 0) {
    return <ComingSoon />;
  }

  return (
    <>
      <CatalogActionLabelContext value={tTryouts("open-exam-cta")}>
        <div className="flex flex-col gap-10 pt-6 pb-24">
          {Arr.map(page.countries, (country, index) => (
            <TryoutHubCountry
              country={country}
              first={index === 0}
              key={country.countryKey}
              onPick={(picked) => savePick.current?.(picked)}
            />
          ))}
        </div>
      </CatalogActionLabelContext>
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

  useImperativeHandle(savePick, () => handleCountryClick);

  return null;
}

/**
 * One country of the hub: its flag and name over its exam cards, so picking an
 * exam is the first click. A card wears the exam's reviewed artwork, or a tile
 * with the exam's own icon, and reports its pick to the hub.
 */
function TryoutHubCountry({
  country,
  first,
  onPick,
}: {
  country: HubCountry;
  first: boolean;
  onPick: (country: HubCountry) => void;
}) {
  const visuals = getTileLooks(
    Arr.map(
      country.exams,
      (exam) =>
        exam.imageSrc ??
        Tuple.make(getTryoutExamIcons(exam.examKey), exam.examKey)
    )
  );

  return (
    <section
      aria-labelledby={`tryout-country-${country.countryKey}`}
      className="flex flex-col gap-4"
    >
      <h2
        className="flex items-center gap-2 text-lg font-medium"
        id={`tryout-country-${country.countryKey}`}
      >
        <CountryFlagIcon
          className="ring-border/60 h-4 w-6 rounded-xs ring-1"
          countryCode={country.countryCode}
        />
        {country.title}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Arr.map(Arr.zip(country.exams, visuals), ([exam, visual], index) => (
          <CatalogCard
            action={(anchor) => (
              <TryoutPageLink
                {...anchor}
                onClick={() => onPick(country)}
                publicPath={exam.entryPath}
              />
            )}
            key={exam.examKey}
            title={exam.title}
          >
            <CatalogCardVisual preload={first && index === 0} visual={visual} />
          </CatalogCard>
        ))}
      </div>
    </section>
  );
}
