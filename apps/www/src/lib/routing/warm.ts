import { untilPageSettled } from "@repo/design-system/lib/settle";
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

/** Every link inside the app. */
const LINKS = 'a[href^="/"]';

/**
 * The tabs of a page, which it marks with `data-warm`. A tab is the likely next
 * press and a phone has no hover to warn the page, so a tab is worth a read of the
 * Worker, which a look at any other link does not spend.
 */
const TABS = `${LINKS}[data-warm]`;

/** The part of the Network Information API that this reads, which Safari and Firefox lack. */
const Connection = Schema.Struct({
  effectiveType: Schema.optionalKey(Schema.String),
  saveData: Schema.optionalKey(Schema.Boolean),
});

/** The part of the router that warming reads, so a look at a link holds no more of it than it needs. */
interface WarmRouter {
  readonly getMatchedRoutes: (
    pathname: string
  ) => readonly [
    matchedRoutes: unknown,
    rawParams: unknown,
    foundRoute: { readonly fullPath: string } | undefined,
  ];
  readonly preloadRoute: (options: {
    readonly href: string;
    readonly to: string;
  }) => Promise<unknown>;
  readonly state: { readonly location: { readonly publicHref: string } };
}

/** Where a link's path ends. */
const QUERY_OR_HASH = /[?#]/u;

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
export function readPressableLinks(
  root: ParentNode,
  height: number,
  selector = LINKS
) {
  const pressable = Arr.filter(
    Arr.fromIterable(root.querySelectorAll(selector)),
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

/** The path of a link's address. */
const pathOf = (href: string) => Str.split(QUERY_OR_HASH)(href)[0];

/** A route's full path in one spelling, as the prerendered templates write it. */
function spell(template: string) {
  return `/${Arr.join(readPathSegments(template), "/")}`;
}

/**
 * Whether a link leads to a page the build wrote, whose loaders read static files.
 * Any other page asks the Worker or Convex, which a look at a link must not spend.
 */
function isStaticLink(router: WarmRouter, href: string) {
  const pathname = pathOf(href);
  const [, , foundRoute] = router.getMatchedRoutes(pathname);
  return (
    !namesFile(pathname) &&
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
  router: WarmRouter
) {
  yield* untilPageSettled;
  if (!canWarm(Reflect.get(navigator, "connection"))) {
    return;
  }
  const current = router.state.location.publicHref;
  const height = window.innerHeight;
  const links = Arr.take(
    Arr.filter(
      Arr.dedupe(
        Arr.appendAll(
          readPressableLinks(document, height, TABS),
          Arr.filter(readPressableLinks(document, height), (href) =>
            isStaticLink(router, href)
          )
        )
      ),
      (href) => href !== current
    ),
    WARMED_LINKS
  );
  yield* Effect.forEach(
    links,
    (href) =>
      Effect.tryPromise(() =>
        router.preloadRoute({ href, to: pathOf(href) })
      ).pipe(Effect.ignore),
    { concurrency: WARMED_AT_ONCE }
  );
});
