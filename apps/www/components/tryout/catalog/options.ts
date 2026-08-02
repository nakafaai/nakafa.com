import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import type { Locale } from "next-intl";

type TryoutHubPage = FunctionReturnType<
  typeof api.tryouts.queries.catalog.getHubPage
>;
type TryoutCountryPage = NonNullable<
  FunctionReturnType<typeof api.tryouts.queries.catalog.getCountryPage>
>;

export type TryoutCountrySelectorOption = Readonly<{
  countryCode: string;
  countryKey: string;
  href: string;
  publicPath: string;
  title: string;
  value: string;
}>;

export type TryoutExamSelectorOption = Readonly<{
  examKey: string;
  href: string;
  title: string;
  value: string;
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
