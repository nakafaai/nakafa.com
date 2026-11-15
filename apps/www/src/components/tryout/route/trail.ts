import type { Ref } from "@confect/core";
import type tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import {
  buildTryoutCountryOptions,
  buildTryoutExamOptions,
  buildTryoutGroupOptions,
  buildTryoutTrackOptions,
  offersGroupChoice,
} from "@/components/tryout/catalog/options";

type TryoutCountries = Ref.Returns<
  typeof tryouts.queries.catalog.getHubPage
>["countries"];
type TryoutExams = NonNullable<
  Ref.Returns<typeof tryouts.queries.catalog.getCountryPage>
>["exams"];
type TryoutGroupPage = NonNullable<
  Ref.Returns<typeof tryouts.queries.catalog.getGroupPage>
>;

/**
 * The trail of a country page: its crumb, which offers every country of the
 * catalog, the page's own among them.
 */
export function buildCountryTrail(
  countries: TryoutCountries,
  countryPath: string
) {
  return {
    country: {
      current: countryPath,
      options: buildTryoutCountryOptions(countries),
    },
  };
}

/**
 * The trail of a group or a track page, each level of its path with the
 * siblings its crumb offers, so the breadcrumb is the page's navigation: the
 * country, the exam, the group when the exam offers that choice, and the track
 * of a track page. An exam whose one group is a year names it in its crumb, as
 * in SNBT 2027, and has no group crumb.
 */
export function buildTryoutTrail(input: {
  readonly countries: TryoutCountries;
  readonly countryPath: string;
  readonly exams: TryoutExams;
  readonly page: Pick<TryoutGroupPage, "exam" | "group" | "groups" | "tracks">;
  readonly trackPath?: string | undefined;
}) {
  const { exam, group, groups, tracks } = input.page;
  const offered = offersGroupChoice(exam.groupAxis, groups);
  return {
    ...buildCountryTrail(input.countries, input.countryPath),
    exam: {
      current: exam.publicPath,
      label: offered ? exam.title : `${exam.title} ${group.title}`,
      options: buildTryoutExamOptions(input.exams),
    },
    ...(offered
      ? {
          group: {
            axis: exam.groupAxis,
            current: group.publicPath,
            options: buildTryoutGroupOptions(groups),
          },
        }
      : {}),
    ...(input.trackPath === undefined
      ? {}
      : {
          track: {
            current: input.trackPath,
            options: buildTryoutTrackOptions(tracks),
          },
        }),
  };
}

/** The trail of any catalog page: a country page's holds its country alone. */
export type TryoutTrail = ReturnType<typeof buildCountryTrail> &
  Partial<Omit<ReturnType<typeof buildTryoutTrail>, "country">>;
