import type { Locale } from "@repo/internationalization/src/locale";
import { Clock, Effect, Option } from "effect";
import { readTryoutSectionPage } from "@/components/tryout/catalog/source.server";
import { readTryoutRouteHead } from "@/components/tryout/route/catalog.server";
import { getTryoutPublicPath } from "@/components/tryout/route/path";
import { serverHandler } from "@/lib/server/fn";

/**
 * Resolves one section URL: the catalog view every visitor sees, with the set page it returns to,
 * which the build prerenders and keeps as the page's static answer. A learner's own attempt through
 * the section is read in the browser (`useLearnerSection`), so the Worker renders nothing personal.
 */
export const readTryoutSectionRoute = Effect.fn("www.tryout.route.readSection")(
  function* (input: {
    readonly country: string;
    readonly exam: string;
    readonly locale: Locale;
    readonly section: string;
    readonly set: string;
    readonly track: string;
  }) {
    const route = {
      country: input.country,
      exam: input.exam,
      locale: input.locale,
      section: input.section,
      set: input.set,
      track: input.track,
    };
    const sectionPath = getTryoutPublicPath(route);
    const [page, head] = yield* Effect.all(
      [
        readTryoutSectionPage(input.locale, sectionPath),
        readTryoutRouteHead({
          kind: "section",
          locale: input.locale,
          publicPath: sectionPath,
        }),
      ],
      { concurrency: "unbounded" }
    );
    if (!page || Option.isNone(head)) {
      return { kind: "notFound" as const };
    }
    return {
      head: head.value,
      kind: "catalog" as const,
      now: yield* Clock.currentTimeMillis,
      page,
      route,
      sectionPath,
      setPath: getTryoutPublicPath({
        country: input.country,
        exam: input.exam,
        set: input.set,
        track: input.track,
      }),
    };
  }
);

/** One section page: its catalog view. */
export const readTryoutSectionHandler = serverHandler(readTryoutSectionRoute);
