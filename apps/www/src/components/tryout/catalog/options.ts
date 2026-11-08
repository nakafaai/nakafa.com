import type { Ref } from "@confect/core";
import type tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import {
  publicTryoutCountryExamValidator,
  publicTryoutCountryValidator,
  publicTryoutExamValidator,
  publicTryoutGroupValidator,
} from "@repo/backend/confect/tryouts/queries/catalogModel";
import { Array as Arr, Schema } from "effect";

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

/** One group of the group selector. */
const TryoutGroupSelectorOptionSchema = Schema.Struct({
  groupKey: publicTryoutGroupValidator.fields.groupKey,
  title: publicTryoutGroupValidator.fields.title,
  value: publicTryoutGroupValidator.fields.publicPath,
});

export type TryoutGroupSelectorOption =
  typeof TryoutGroupSelectorOptionSchema.Type;

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
    groupKey: group.groupKey,
    title: group.title,
    value: group.publicPath,
  }));
}
