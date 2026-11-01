import { untilPageSettled } from "@repo/design-system/lib/settle";
import type { AnyRouter } from "@tanstack/react-router";
import { Array as Arr, Effect, Option, Schema, String as Str } from "effect";
import { PRERENDERED_ROUTE_TEMPLATES } from "@/lib/routing/prerendered";
import { namesFile, readPathSegments } from "@/lib/routing/template";

/**
 * The most links that one look warms. A phone's first screen holds about this many,
 * and each one spends the reader's data on a page they may never open.
 */
const WARMED_LINKS = 6;

/** The links two at a time, so a slow phone keeps room for what the reader does. */
const WARMED_AT_ONCE = 2;

/** The part of the Network Information API that this reads, which Safari and Firefox lack. */
const Connection = Schema.Struct({
  effectiveType: Schema.optionalKey(Schema.String),
  saveData: Schema.optionalKey(Schema.Boolean),
});

/** The connections that cannot spare a page the reader did not ask for. */
const THIN_CONNECTIONS = ["slow-2g", "2g"];

/** Whether the reader's connection can spare the pages they may open next. */
export function canWarm(connection: unknown) {
  return Option.match(Schema.decodeUnknownOption(Connection)(connection), {
    onNone: () => true,
    onSome: ({ effectiveType, saveData }) =>
      saveData !== true && !Arr.contains(THIN_CONNECTIONS, effectiveType ?? ""),
  });
}

/** The addresses that the reader can press now, on screen, top of the page first. */
export function readPressableLinks(root: ParentNode, height: number) {
  const pressable = Arr.filter(
    Arr.fromIterable(root.querySelectorAll('a[href^="/"]')),
    (link) => {
      const { bottom, top } = link.getBoundingClientRect();
      return bottom > 0 && top < height && link.checkVisibility();
    }
  );
  return Arr.dedupe(
    Arr.getSomes(
      Arr.map(pressable, (link) =>
        Option.fromNullishOr(link.getAttribute("href"))
      )
    )
  );
}

/** A route's full path in one spelling, as the prerendered templates write it. */
function spell(template: string) {
  return `/${Arr.join(readPathSegments(template), "/")}`;
}

/**
 * Whether a link leads to a page the build wrote, whose loaders read static files.
 * Any other page asks the Worker or Convex, which a look at a link must not spend.
 */
function isStaticLink(router: AnyRouter, href: string) {
  const { pathname } = router.buildLocation({ href });
  const { foundRoute } = router.getMatchedRoutes(pathname);
  return (
    !namesFile(Str.split("?")(href)[0]) &&
    foundRoute !== undefined &&
    Arr.contains(
      Arr.map(PRERENDERED_ROUTE_TEMPLATES, spell),
      spell(foundRoute.fullPath)
    )
  );
}

/**
 * Loads the pages a reader can press next, once the page in front of them has
 * settled, so a press finds its code and its data in hand. A press on a slow network
 * cannot be fast any other way: one round trip alone costs a phone most of what a
 * press may take. A link that cannot load stays cold, and its press reads as before.
 */
export const warmLinks = Effect.fn("www.routing.warmLinks")(function* (
  router: AnyRouter
) {
  yield* untilPageSettled;
  if (!canWarm(Reflect.get(navigator, "connection"))) {
    return;
  }
  const current = router.state.location.publicHref;
  const links = Arr.take(
    Arr.filter(
      readPressableLinks(document, window.innerHeight),
      (href) => href !== current && isStaticLink(router, href)
    ),
    WARMED_LINKS
  );
  yield* Effect.forEach(
    links,
    (href) =>
      Effect.tryPromise(() => router.preloadRoute({ href })).pipe(
        Effect.ignore
      ),
    { concurrency: WARMED_AT_ONCE }
  );
});
