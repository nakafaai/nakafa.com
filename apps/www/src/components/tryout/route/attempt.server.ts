import type { Locale } from "@repo/internationalization/src/locale";
import { Clock, Effect, Option } from "effect";
import { readTryoutSetPage } from "@/components/tryout/catalog/source.server";
import { readTryoutRouteHead } from "@/components/tryout/route/catalog.server";
import { createTryoutSetRestartTarget } from "@/components/tryout/route/owner";
import { getTryoutHref } from "@/components/tryout/route/path";
import { serverHandler } from "@/lib/server/fn";

/**
 * Resolves one set URL: the catalog view every visitor sees, which the build prerenders and keeps as
 * the page's static answer. A learner's own attempt on the set is read in the browser
 * (`useLearnerSet`), so the Worker renders nothing personal for it.
 */
export const readTryoutSetRoute = Effect.fn("www.tryout.route.readSet")(
  function* (input: {
    readonly country: string;
    readonly exam: string;
    readonly locale: Locale;
    readonly set: string;
    readonly track: string;
  }) {
    const route = {
      country: input.country,
      exam: input.exam,
      locale: input.locale,
      set: input.set,
      track: input.track,
    };
    const setPath = getTryoutHref(route).slice(1);
    const [page, head] = yield* Effect.all(
      [
        readTryoutSetPage(input.locale, setPath),
        readTryoutRouteHead({
          kind: "set",
          locale: input.locale,
          publicPath: setPath,
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
      restartTarget: Option.getOrNull(createTryoutSetRestartTarget(page)),
      route,
    };
  }
);

/** One set page: its catalog view. */
export const readTryoutSetHandler = serverHandler(readTryoutSetRoute);
