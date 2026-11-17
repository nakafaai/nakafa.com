import { env } from "cloudflare:workers";
import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { SITE_ORIGIN } from "@repo/seo/origin";
import {
  Array as Arr,
  Effect,
  HashSet,
  MutableRef,
  Option,
  Record as Rec,
  Schema,
} from "effect";
import {
  TRYOUT_MAP_PATH,
  TryoutMapJson,
  type TryoutMapLocale,
} from "@/lib/routing/public/tryout/map";
import { hasStaticRelease } from "@/lib/routing/release";

/** The release holds no readable try-out map: a defect of its build, never a reader's miss. */
export class TryoutMapUnavailable extends Schema.TaggedError<
  TryoutMapUnavailable,
  { readonly brand: unique symbol }
>()("TryoutMapUnavailable", {
  status: Schema.optionalKey(Schema.Int),
}) {}

/** Turns one locale's map into what each lookup reads: its served paths and section pages as sets. */
function toLocaleRoutes(map: TryoutMapLocale) {
  return {
    ...map,
    paths: HashSet.fromIterable(map.paths),
    sections: HashSet.fromIterable(map.sections),
  };
}

/** One locale's map as the Worker looks it up. */
type LocaleRoutes = ReturnType<typeof toLocaleRoutes>;

/** The map this isolate has read. The release's assets cannot change under a running Worker. */
const keptMap = MutableRef.make(Option.none<Record<string, LocaleRoutes>>());

/** Reads the release's try-out map, from the asset the first time and from memory after. */
const readMap = Effect.fn("www.routing.tryoutMap.read")(function* () {
  const kept = MutableRef.get(keptMap);
  if (Option.isSome(kept)) {
    return kept.value;
  }
  const file = yield* Effect.promise(() =>
    env.ASSETS.fetch(new Request(new URL(TRYOUT_MAP_PATH, SITE_ORIGIN)))
  );
  if (!file.ok) {
    return yield* new TryoutMapUnavailable({ status: file.status });
  }
  const map = yield* Effect.promise(() => file.text()).pipe(
    Effect.flatMap(Schema.decodeEffect(TryoutMapJson)),
    Effect.mapError(() => new TryoutMapUnavailable({}))
  );
  const routes = Rec.map(map, toLocaleRoutes);
  MutableRef.set(keptMap, Option.some(routes));
  return routes;
});

/**
 * Reads one locale's part of the map, or none in a prerender or a development
 * server, which bind no assets: there no retired try-out URL redirects, as no
 * retired subject lesson does.
 */
const readLocale = Effect.fn("www.routing.tryoutMap.locale")(function* (
  appLocale: ActiveAppLocaleCode
) {
  if (!hasStaticRelease()) {
    return Option.none<LocaleRoutes>();
  }
  return Rec.get(yield* readMap(), appLocale);
});

/** The hub of "Try out" in one locale: its countries, in order, none without a map. */
export const readMappedHubPage = Effect.fn("www.routing.tryoutMap.hub")(
  function* (args: { readonly appLocale: ActiveAppLocaleCode }) {
    const locale = yield* readLocale(args.appLocale);
    return {
      countries: Option.match(locale, {
        onNone: () => [],
        onSome: (map) => map.countries,
      }),
    };
  }
);

/** One exam with its groups, or null when the catalog serves no such exam. */
export const readMappedExamPage = Effect.fn("www.routing.tryoutMap.exam")(
  function* (args: {
    readonly appLocale: ActiveAppLocaleCode;
    readonly publicPath: string;
  }) {
    const locale = yield* readLocale(args.appLocale);
    return Option.getOrNull(
      Option.flatMap(locale, (map) => Rec.get(map.exams, args.publicPath))
    );
  }
);

/** One group with its tracks, or null when the catalog serves no such group. */
export const readMappedGroupPage = Effect.fn("www.routing.tryoutMap.group")(
  function* (args: {
    readonly appLocale: ActiveAppLocaleCode;
    readonly publicPath: string;
  }) {
    const locale = yield* readLocale(args.appLocale);
    return Option.getOrNull(
      Option.map(
        Option.flatMap(locale, (map) => Rec.get(map.groups, args.publicPath)),
        (tracks) => ({
          tracks: Arr.map(tracks, (publicPath) => ({ publicPath })),
        })
      )
    );
  }
);

/** One section page, or null when the section is no page of the catalog. */
export const readMappedSectionPage = Effect.fn("www.routing.tryoutMap.section")(
  function* (args: {
    readonly appLocale: ActiveAppLocaleCode;
    readonly publicPath: string;
  }) {
    const locale = yield* readLocale(args.appLocale);
    return Option.exists(locale, (map) =>
      HashSet.has(map.sections, args.publicPath)
    )
      ? { publicPath: args.publicPath }
      : null;
  }
);

/**
 * The path of one try-out page in another locale, or null. In its own locale a
 * path answers itself when the catalog serves it. Into another locale, the map
 * holds what the redirects ask: the canonical SNBT exam and sets, from English.
 */
export const readMappedLocalizedPath = Effect.fn(
  "www.routing.tryoutMap.localizedPath"
)(function* (args: {
  readonly currentAppLocale: ActiveAppLocaleCode;
  readonly publicPath: string;
  readonly targetAppLocale: ActiveAppLocaleCode;
}) {
  const target = yield* readLocale(args.targetAppLocale);
  if (args.currentAppLocale === args.targetAppLocale) {
    return Option.exists(target, (map) =>
      HashSet.has(map.paths, args.publicPath)
    )
      ? args.publicPath
      : null;
  }
  return Option.getOrNull(
    Option.flatMap(target, (map) =>
      Option.flatMap(
        Rec.get(map.localized, args.publicPath),
        Option.fromNullishOr
      )
    )
  );
});

/** Reads whether the active signed catalog serves one exact route in its own locale. */
export function readActiveTryoutPath(
  appLocale: ActiveAppLocaleCode,
  path: string
) {
  return readMappedLocalizedPath({
    currentAppLocale: appLocale,
    publicPath: path,
    targetAppLocale: appLocale,
  });
}
