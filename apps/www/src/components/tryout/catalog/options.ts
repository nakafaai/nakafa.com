import type { Ref } from "@confect/core";
import type { GroupAxisSchema } from "@nakafa/aksara-contracts/assessment/catalog";
import type tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import {
  publicTryoutCountryExamValidator,
  publicTryoutCountryValidator,
  publicTryoutExamValidator,
  publicTryoutGroupChoiceValidator,
  publicTryoutTrackValidator,
} from "@repo/backend/confect/tryouts/queries/model";
import { Array as Arr, HashMap, Option, Schema } from "effect";

type TryoutHubPage = Ref.Returns<typeof tryouts.queries.catalog.getHubPage>;
type TryoutCountryPage = NonNullable<
  Ref.Returns<typeof tryouts.queries.catalog.getCountryPage>
>;
type TryoutGroupPage = NonNullable<
  Ref.Returns<typeof tryouts.queries.catalog.getGroupPage>
>;

const TryoutCountrySelectorOptionSchema = Schema.Struct({
  countryCode: publicTryoutCountryValidator.fields.countryCode,
  countryKey: publicTryoutCountryValidator.fields.countryKey,
  publicPath: publicTryoutCountryValidator.fields.publicPath,
  title: publicTryoutCountryValidator.fields.title,
  value: publicTryoutCountryValidator.fields.publicPath,
});

export type TryoutCountrySelectorOption =
  typeof TryoutCountrySelectorOptionSchema.Type;

/** One exam of the exam selector: its value is the exam's path, and its link lands on the exam's entry. */
const TryoutExamSelectorOptionSchema = Schema.Struct({
  entryPath: publicTryoutCountryExamValidator.fields.entryPath,
  examKey: publicTryoutExamValidator.fields.examKey,
  title: publicTryoutExamValidator.fields.title,
  value: publicTryoutExamValidator.fields.publicPath,
});

export type TryoutExamSelectorOption =
  typeof TryoutExamSelectorOptionSchema.Type;

/** One group of the group selector: its value is the group's path, and choosing it lands on the group's entry. */
const TryoutGroupSelectorOptionSchema = Schema.Struct({
  entryPath: publicTryoutGroupChoiceValidator.fields.entryPath,
  groupKey: publicTryoutGroupChoiceValidator.fields.groupKey,
  title: publicTryoutGroupChoiceValidator.fields.title,
  value: publicTryoutGroupChoiceValidator.fields.publicPath,
});

export type TryoutGroupSelectorOption =
  typeof TryoutGroupSelectorOptionSchema.Type;

/** One track of a group, a sibling its crumb offers: its value is the track's path, where choosing it lands. */
const TryoutTrackOptionSchema = Schema.Struct({
  title: publicTryoutTrackValidator.fields.title,
  trackKey: publicTryoutTrackValidator.fields.trackKey,
  value: publicTryoutTrackValidator.fields.publicPath,
});

export type TryoutTrackOption = typeof TryoutTrackOptionSchema.Type;

/** Projects active country rows into localized selector options. */
export function buildTryoutCountryOptions(
  countries: TryoutHubPage["countries"]
): readonly TryoutCountrySelectorOption[] {
  return Arr.map(countries, (country) => ({
    countryCode: country.countryCode,
    countryKey: country.countryKey,
    publicPath: country.publicPath,
    title: country.title,
    value: country.publicPath,
  }));
}

/** Projects active exam rows into localized selector options. */
export function buildTryoutExamOptions(
  exams: TryoutCountryPage["exams"]
): readonly TryoutExamSelectorOption[] {
  return Arr.map(exams, (exam) => ({
    entryPath: exam.entryPath,
    examKey: exam.examKey,
    title: exam.title,
    value: exam.publicPath,
  }));
}

/** Projects the groups of one exam into localized selector options. */
export function buildTryoutGroupOptions(
  groups: TryoutGroupPage["groups"]
): readonly TryoutGroupSelectorOption[] {
  return Arr.map(groups, (group) => ({
    entryPath: group.entryPath,
    groupKey: group.groupKey,
    title: group.title,
    value: group.publicPath,
  }));
}

/** Projects the tracks of one group into localized options. */
export function buildTryoutTrackOptions(
  tracks: TryoutGroupPage["tracks"]
): readonly TryoutTrackOption[] {
  return Arr.map(tracks, (track) => ({
    title: track.title,
    trackKey: track.trackKey,
    value: track.publicPath,
  }));
}

/**
 * Whether a page's header offers its exam's groups. A learner picks their own
 * grade or Studienkolleg, so that choice shows even before a second option
 * joins; one year is already in the exam's name, as in SNBT 2027, so a single
 * year shows no selector.
 */
export function offersGroupChoice(
  axis: typeof GroupAxisSchema.Type,
  groups: readonly unknown[]
) {
  return groups.length > 1 || axis !== "year";
}

/** The country each locale's readers live in, by the country code a catalog country carries. A locale of many countries, such as English, names none. */
const LOCALE_COUNTRY_CODES = HashMap.make(
  ["de", "DE"],
  ["id", "ID"],
  ["ms", "MY"]
);

/**
 * The country whose page a locale's "Try out" opens: the locale's own country
 * when the catalog holds it, else the catalog's first country. A learner's
 * last choice goes before this, where the sidebar knows it.
 */
export function readLocaleCountry<
  Country extends { readonly countryCode: string },
>(locale: string, countries: readonly Country[]) {
  return Option.orElse(
    Option.flatMap(HashMap.get(LOCALE_COUNTRY_CODES, locale), (code) =>
      Arr.findFirst(countries, (country) => country.countryCode === code)
    ),
    () => Arr.head(countries)
  );
}
