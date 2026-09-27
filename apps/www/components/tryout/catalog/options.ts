import type { Ref } from "@confect/core";
import type refs from "@repo/backend/confect/_generated/refs";

import type { Locale } from "next-intl";

type TryoutHubPage = Ref.Returns<
  typeof refs.public.tryouts.queries.catalog.getHubPage
>;
type TryoutCountryPage = NonNullable<
  Ref.Returns<typeof refs.public.tryouts.queries.catalog.getCountryPage>
>;
type TryoutCountry = TryoutHubPage["countries"][number];
type TryoutExam = TryoutCountryPage["exams"][number];

export type TryoutCountrySelectorOption = Readonly<{
  countryCode: TryoutCountry["countryCode"];
  countryKey: TryoutCountry["countryKey"];
  href: string;
  publicPath: TryoutCountry["publicPath"];
  title: TryoutCountry["title"];
  value: TryoutCountry["publicPath"];
}>;

export type TryoutExamSelectorOption = Readonly<{
  examKey: TryoutExam["examKey"];
  href: string;
  title: TryoutExam["title"];
  value: TryoutExam["publicPath"];
}>;

/** Projects active country rows into localized selector options. */
export function buildTryoutCountryOptions(
  locale: Locale,
  countries: TryoutHubPage["countries"]
): readonly TryoutCountrySelectorOption[] {
  return countries.map((country) => ({
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
  return exams.map((exam) => ({
    examKey: exam.examKey,
    href: `/${locale}/${exam.publicPath}`,
    title: exam.title,
    value: exam.publicPath,
  }));
}
