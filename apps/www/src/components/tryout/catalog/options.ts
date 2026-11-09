import type { Ref } from "@confect/core";
import type { GroupAxisSchema } from "@nakafa/aksara-contracts/assessment/catalog";
import type tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import {
  publicTryoutCountryValidator,
  publicTryoutGroupChoiceValidator,
} from "@repo/backend/confect/tryouts/queries/model";
import { Array as Arr, Schema } from "effect";

type TryoutHubPage = Ref.Returns<typeof tryouts.queries.catalog.getHubPage>;
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

/** One group of the group selector: its value is the group's path, and choosing it lands on the group's entry. */
const TryoutGroupSelectorOptionSchema = Schema.Struct({
  entryPath: publicTryoutGroupChoiceValidator.fields.entryPath,
  groupKey: publicTryoutGroupChoiceValidator.fields.groupKey,
  title: publicTryoutGroupChoiceValidator.fields.title,
  value: publicTryoutGroupChoiceValidator.fields.publicPath,
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

/**
 * Whether a page's header offers its exam's groups, the header's one primary
 * control. A learner picks their own grade or Studienkolleg, so that choice
 * shows even before a second option joins; one year is already in the exam's
 * name, as in SNBT 2027, so a single year shows no selector.
 */
export function offersGroupChoice(
  axis: typeof GroupAxisSchema.Type,
  groups: readonly unknown[]
) {
  return groups.length > 1 || axis !== "year";
}
