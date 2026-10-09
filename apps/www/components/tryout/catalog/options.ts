import type { Ref } from "@confect/core";
import type tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import {
  publicTryoutCountryValidator,
  publicTryoutExamValidator,
} from "@repo/backend/confect/tryouts/queries/catalogModel";
import { Array as Arr, Schema } from "effect";
import type { Locale } from "next-intl";

type TryoutHubPage = Ref.Returns<typeof tryouts.queries.catalog.getHubPage>;
type TryoutCountryPage = NonNullable<
  Ref.Returns<typeof tryouts.queries.catalog.getCountryPage>
>;

const TryoutCountrySelectorOptionSchema = Schema.Struct({
  countryCode: publicTryoutCountryValidator.fields.countryCode,
  countryKey: publicTryoutCountryValidator.fields.countryKey,
  href: Schema.String,
  publicPath: publicTryoutCountryValidator.fields.publicPath,
  title: publicTryoutCountryValidator.fields.title,
  value: publicTryoutCountryValidator.fields.publicPath,
});

export type TryoutCountrySelectorOption =
  typeof TryoutCountrySelectorOptionSchema.Type;

const TryoutExamSelectorOptionSchema = Schema.Struct({
  examKey: publicTryoutExamValidator.fields.examKey,
  href: Schema.String,
  title: publicTryoutExamValidator.fields.title,
  value: publicTryoutExamValidator.fields.publicPath,
});

export type TryoutExamSelectorOption =
  typeof TryoutExamSelectorOptionSchema.Type;

/** Projects active country rows into localized selector options. */
export function buildTryoutCountryOptions(
  locale: Locale,
  countries: TryoutHubPage["countries"]
): readonly TryoutCountrySelectorOption[] {
  return Arr.map(countries, (country) => ({
    countryCode: country.countryCode,
    countryKey: country.countryKey,
    href: `/${locale}/${country.publicPath}`,
    publicPath: country.publicPath,
    title: country.title,
    value: country.publicPath,
  }));
}

/** Projects active exam rows into localized selector options. */
export function buildTryoutExamOptions(
  locale: Locale,
  exams: TryoutCountryPage["exams"]
): readonly TryoutExamSelectorOption[] {
  return Arr.map(exams, (exam) => ({
    examKey: exam.examKey,
    href: `/${locale}/${exam.publicPath}`,
    title: exam.title,
    value: exam.publicPath,
  }));
}
