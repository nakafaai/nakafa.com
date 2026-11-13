import type { Locale } from "@repo/internationalization/src/locale";
import { readServerTranslator } from "@repo/internationalization/src/translator";
import { Array as Arr, Clock, Effect, Option } from "effect";
import {
  readTryoutSetPage,
  readTryoutSetSamples,
} from "@/components/tryout/catalog/source.server";
import { CATALOG_QUERY_DEFAULTS } from "@/components/tryout/catalog/table/query";
import { readTryoutTrackSetList } from "@/components/tryout/route/catalog.server";
import { readTryoutRouteHead } from "@/components/tryout/route/metadata.server";
import { createTryoutSetRestartTarget } from "@/components/tryout/route/owner";
import { getTryoutHref } from "@/components/tryout/route/path";
import { serverHandler } from "@/lib/server/fn";

/**
 * Resolves one set URL: the catalog view every visitor sees, which the build prerenders and keeps as
 * the page's static answer, with the set's worked samples and the other sets of its track, so readers
 * and search engines meet its real questions and reach its siblings. A learner's own attempt on the set
 * is read in the browser (`useLearnerSet`), so the Worker renders nothing personal for it.
 */
export const readTryoutSetRoute = Effect.fn("www.tryout.route.readSet")(
  function* (input: {
    readonly country: string;
    readonly exam: string;
    readonly group: string;
    readonly locale: Locale;
    readonly set: string;
    readonly track: string;
  }) {
    const route = {
      country: input.country,
      exam: input.exam,
      group: input.group,
      locale: input.locale,
      set: input.set,
      track: input.track,
    };
    const setPath = getTryoutHref(route).slice(1);
    const [page, samples, head, tTryouts] = yield* Effect.all(
      [
        readTryoutSetPage(input.locale, setPath),
        readTryoutSetSamples(input.locale, setPath),
        readTryoutRouteHead({
          kind: "set",
          locale: input.locale,
          publicPath: setPath,
        }),
        Effect.promise(() =>
          readServerTranslator({ locale: input.locale, namespace: "Tryouts" })
        ),
      ],
      { concurrency: "unbounded" }
    );
    if (!page || Option.isNone(samples) || Option.isNone(head)) {
      return { kind: "notFound" as const };
    }
    const track = yield* readTryoutTrackSetList({
      locale: input.locale,
      search: CATALOG_QUERY_DEFAULTS,
      track: {
        countryKey: page.set.countryKey,
        examKey: page.set.examKey,
        trackKey: page.set.trackKey,
      },
    });
    const exam = `${page.exam.title} ${page.group.title} ${page.track.title}`;
    const values = { exam, set: page.set.title };
    return {
      // Every exam has a Set 1, so the page names its exam too.
      head: {
        ...head.value,
        description:
          page.set.description ?? tTryouts("set-metadata-description", values),
        title: tTryouts("set-search-title", values),
      },
      kind: "catalog" as const,
      now: yield* Clock.currentTimeMillis,
      page,
      restartTarget: Option.getOrNull(createTryoutSetRestartTarget(page)),
      route,
      samples: samples.value,
      siblings: Arr.map(
        Arr.filter(track.result.page, (set) => set.setKey !== page.set.setKey),
        (set) => ({
          durationSeconds: set.durationSeconds,
          publicPath: set.publicPath,
          setKey: set.setKey,
          title: set.title,
        })
      ),
    };
  }
);

/** One set page: its catalog view. */
export const readTryoutSetHandler = serverHandler(readTryoutSetRoute);
