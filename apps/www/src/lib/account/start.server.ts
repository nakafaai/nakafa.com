import type { Ref } from "@confect/core";
import type learningPreferences from "@repo/backend/confect/_generated/refs/learningPreferences";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { Array as Arr, Effect } from "effect";
import type { LocaleInput } from "@/lib/account/input";
import type { TryoutStart } from "@/lib/account/start";
import { readOptional } from "@/lib/data/read.server";

/** The try-out country a learner last picked, as its preference reads it, none when they picked none. */
type Preference =
  | Ref.Returns<typeof learningPreferences.queries.getCurrentTryout>
  | undefined;

/**
 * What a learner who has sat no try-out yet can start (`TryoutStart`): the exams of the country they last
 * picked on the try-out page, the only thing the app knows of where they sit, or every country that holds
 * try-outs when they picked none. It costs a read only on the home of a learner with no try-out.
 */
export const readTryoutStart = Effect.fn("www.home.readTryoutStart")(function* (
  locale: (typeof LocaleInput.Type)["locale"],
  preference: Preference,
  token: string | undefined
): Effect.fn.Return<TryoutStart> {
  const country = preference?.country;
  if (country !== undefined) {
    const page = yield* readOptional(
      tryouts.queries.catalog.getCountryPage,
      { appLocale: locale, publicPath: country.publicPath },
      token
    );
    if (page) {
      return {
        country: {
          countryCode: page.country.countryCode,
          publicPath: page.country.publicPath,
          title: page.country.title,
        },
        exams: Arr.map(page.exams, (exam) => ({
          examKey: exam.examKey,
          title: exam.title,
        })),
        kind: "country",
      };
    }
  }
  const hub = yield* readOptional(
    tryouts.queries.catalog.getHubPage,
    { appLocale: locale },
    token
  );
  return {
    countries: Arr.map(hub?.countries ?? [], (place) => ({
      countryCode: place.countryCode,
      title: place.title,
    })),
    kind: "countries",
  };
});
