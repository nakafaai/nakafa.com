import { getTileShifts } from "@repo/design-system/lib/look";
import { getRouteApi } from "@tanstack/react-router";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { ConvexIsland } from "@/components/providers/island";
import { TryoutList } from "@/components/tryout/catalog/list";
import { useCountryChoice } from "@/components/tryout/catalog/trail";

const countryRoute = getRouteApi("/$locale/_main/try-out/$country/");

/** The DOM id of the heading that names the other countries. */
const COUNTRIES_TITLE = "tryout-countries";

/**
 * The other countries of the catalog, in the catalog's order, each a row that opens its page. The build
 * prerenders them with the page, so a reader moves to another country where the choice belongs and a
 * crawler reaches every country from any one of them: a home links only its own locale's country, and the
 * crumb's menu draws its links only once it opens. A learner's press saves the country as the crumb's does.
 */
export function TryoutCountryOthers() {
  return (
    <ConvexIsland fallback={<CountryList />} keepsPress>
      <LearnerCountryList />
    </ConvexIsland>
  );
}

/** A learner's list: choosing a country saves it as the learner's try-out country. */
function LearnerCountryList() {
  const country = countryRoute.useLoaderData({
    select: (route) => route.trail.country,
  });
  const chooseCountry = useCountryChoice(country, "tryout-country-list");
  return <CountryList onChoose={chooseCountry} />;
}

/** The heading and the rows of the other countries, or nothing when the catalog has one. */
function CountryList({
  onChoose,
}: {
  onChoose?: (countryKey: string) => void;
}) {
  const t = useTranslations("Tryouts");
  const country = countryRoute.useLoaderData({
    select: (route) => route.trail.country,
  });
  const others = Arr.filter(
    country.options,
    (option) => option.value !== country.current
  );
  if (others.length === 0) {
    return null;
  }
  const shifts = getTileShifts(Arr.map(others, (option) => option.countryKey));

  return (
    <nav aria-labelledby={COUNTRIES_TITLE} className="space-y-3">
      <h2 className="text-lg font-medium" id={COUNTRIES_TITLE}>
        {t("countries-title")}
      </h2>
      <TryoutList
        emptyLabel={t("list-empty")}
        rows={Arr.zipWith(others, shifts, (option, shift) => ({
          address: { publicPath: option.publicPath },
          description: t("country-exams", { count: option.examCount }),
          key: option.countryKey,
          ...(onChoose === undefined
            ? {}
            : { onPress: () => onChoose(option.countryKey) }),
          title: option.title,
          visual: {
            countryCode: option.countryCode,
            seed: option.countryKey,
            shift,
          },
        }))}
      />
    </nav>
  );
}
