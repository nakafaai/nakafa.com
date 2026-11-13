import type { Locale } from "@repo/internationalization/src/locale";
import { Effect, Option } from "effect";
import {
  buildTryoutCountryOptions,
  buildTryoutExamOptions,
  buildTryoutGroupOptions,
  buildTryoutTrackOptions,
  offersGroupChoice,
} from "@/components/tryout/catalog/options";
import {
  readTryoutCountryPage,
  readTryoutGroupPage,
  readTryoutHubPage,
} from "@/components/tryout/catalog/source.server";

/**
 * Reads the trail of one try-out page: each level of its path, the country,
 * the exam, the group and the track, with the siblings its crumb offers, so the
 * breadcrumb is the page's navigation. An exam whose one group is a year names
 * it in its crumb, as in SNBT 2027, and has no group crumb. The trail is none
 * when the catalog holds no country, exam or group the path names.
 */
export const readTryoutTrail = Effect.fn("www.tryout.route.readTrail")(
  function* (input: {
    readonly countryPath: string;
    readonly groupPath?: string | undefined;
    readonly locale: Locale;
    readonly trackPath?: string | undefined;
  }) {
    const hub = yield* readTryoutHubPage(input.locale);
    const country = {
      current: input.countryPath,
      options: buildTryoutCountryOptions(hub.countries),
    };
    if (input.groupPath === undefined) {
      return Option.some({ country });
    }
    const [countryPage, page] = yield* Effect.all(
      [
        readTryoutCountryPage(input.locale, input.countryPath),
        readTryoutGroupPage(input.locale, input.groupPath),
      ],
      { concurrency: "unbounded" }
    );
    if (Option.isNone(countryPage) || !page) {
      return Option.none();
    }
    const offered = offersGroupChoice(page.exam.groupAxis, page.groups);
    const exam = {
      current: page.exam.publicPath,
      label: offered
        ? page.exam.title
        : `${page.exam.title} ${page.group.title}`,
      options: buildTryoutExamOptions(countryPage.value.exams),
    };
    const group = {
      axis: page.exam.groupAxis,
      current: input.groupPath,
      options: buildTryoutGroupOptions(page.groups),
    };
    const track =
      input.trackPath === undefined
        ? {}
        : {
            track: {
              current: input.trackPath,
              options: buildTryoutTrackOptions(page.tracks),
            },
          };
    return Option.some({
      country,
      exam,
      ...(offered ? { group } : {}),
      ...track,
    });
  }
);
