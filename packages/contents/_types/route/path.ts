import type { Locale } from "@repo/contents/_types/content";
import {
  type MaterialRouteDomain,
  MaterialRouteDomainSchema,
} from "@repo/contents/_types/material/domain";
import {
  DuplicatePublicRouteError,
  InvalidPublicRouteSourceError,
  MissingPublicSlugError,
} from "@repo/contents/_types/route/error";
import {
  PublicContentRouteSchema,
  PublicCurriculumRouteSchema,
  type PublicRoute,
} from "@repo/contents/_types/route/schema";
import {
  PublicRoutePathSchema,
  PublicRouteSegmentSchema,
} from "@repo/contents/_types/route/segment";
import {
  PUBLIC_ROUTE_SURFACES,
  type PublicRouteSurfaceKey,
} from "@repo/contents/_types/route/surface";
import { Effect, Schema } from "effect";

export type PublicRouteProjectionError =
  | DuplicatePublicRouteError
  | InvalidPublicRouteSourceError
  | MissingPublicSlugError;

export type PublicRouteNamespace = PublicRouteSurfaceKey;

/** Reads a localized static namespace segment from the route surface contract. */
export const getPublicRouteNamespace = Effect.fn("contents.route.namespace")(
  function* (namespace: PublicRouteNamespace, locale: Locale) {
    return yield* lookupNamespaceSegment(namespace, locale);
  }
);

/** Finds a localized namespace segment or fails with a typed route error. */
export function lookupNamespaceSegment(
  namespace: PublicRouteSurfaceKey,
  locale: Locale
) {
  return Effect.gen(function* () {
    const segment = readNamespaceSegment(namespace, locale);

    if (!segment) {
      return yield* Effect.fail(
        new MissingPublicSlugError({
          locale,
          source: "route-surface",
          value: namespace,
        })
      );
    }

    return segment;
  });
}

/** Reads a localized namespace segment from the already decoded route surface registry. */
export function readNamespaceSegment(
  namespace: PublicRouteSurfaceKey,
  locale: Locale
) {
  return PUBLIC_ROUTE_SURFACES.find((item) => item.key === namespace)
    ?.routeSlugs[locale];
}

/** Finds a source-owned localized domain slug or fails without invented text. */
export function lookupDomainSlug(
  domains: readonly MaterialRouteDomain[],
  kind: MaterialRouteDomain["kind"],
  domain: MaterialRouteDomain["domain"],
  locale: Locale
) {
  return Effect.gen(function* () {
    const slug = readDomainSlug(domains, kind, domain, locale);

    if (!slug) {
      return yield* Effect.fail(
        new MissingPublicSlugError({
          locale,
          source: `${kind}-domain`,
          value: domain,
        })
      );
    }

    return slug;
  });
}

/** Reads one source-owned domain slug from decoded domain rows. */
export function readDomainSlug(
  domains: readonly MaterialRouteDomain[],
  kind: MaterialRouteDomain["kind"],
  domain: MaterialRouteDomain["domain"],
  locale: Locale
) {
  return domains.find(
    (candidate) => candidate.kind === kind && candidate.domain === domain
  )?.routeSlugs[locale];
}

/** Decodes one generated canonical content route row. */
export function decodeContentRoute(
  input: Schema.Schema.Encoded<typeof PublicContentRouteSchema>
) {
  return Schema.decodeUnknown(PublicContentRouteSchema)(input).pipe(
    Effect.mapError(toInvalidSourceError)
  );
}

/** Decodes one generated curriculum context route row. */
export function decodeCurriculumRoute(
  input: Schema.Schema.Encoded<typeof PublicCurriculumRouteSchema>
) {
  return Schema.decodeUnknown(PublicCurriculumRouteSchema)(input).pipe(
    Effect.mapError(toInvalidSourceError)
  );
}

/** Decodes a branded public path from already joined route segments. */
export function decodePublicPath(path: string) {
  return Schema.decodeUnknown(PublicRoutePathSchema)(path).pipe(
    Effect.mapError(toInvalidSourceError)
  );
}

/**
 * Decodes a public path for static route projection without starting an Effect runtime.
 *
 * Use this only for source-controlled registries that were already decoded at
 * module load. Caller-supplied or test-mutated route data should use the
 * Effect-native decoders so expected projection failures stay typed.
 */
export function decodePublicPathSync(path: string) {
  return Schema.decodeUnknownSync(PublicRoutePathSchema)(path);
}

/** Joins and decodes route segments into one branded public path. */
export function makePath(segments: readonly (string | undefined)[]) {
  return decodePublicPath(joinRouteSegments(segments));
}

/**
 * Joins and decodes source-owned route segments for static route helpers.
 *
 * This keeps `generateStaticParams` paths deterministic under Cache Components:
 * no Effect runtime is created while Next is prerendering static routes.
 */
export function makePathSync(segments: readonly (string | undefined)[]) {
  return decodePublicPathSync(joinRouteSegments(segments));
}

/** Reads and validates the final public path segment. */
export function lastPathSegment(path: string) {
  const segments = path.split("/").filter(Boolean);
  const segment = segments.at(-1);

  return Schema.decodeUnknown(PublicRouteSegmentSchema)(segment).pipe(
    Effect.mapError(toInvalidSourceError)
  );
}

/** Reads the final public path segment for pure static route helpers. */
export function lastPathSegmentSync(path: string) {
  const segments = path.split("/").filter(Boolean);
  const segment = segments.at(-1);

  return Schema.decodeUnknownSync(PublicRouteSegmentSchema)(segment);
}

/** Fails when two generated rows would claim the same localized public path. */
export function uniqueRoutes<TRoute extends PublicRoute>(
  routes: readonly TRoute[]
) {
  return Effect.gen(function* () {
    const byPath = new Map<string, TRoute>();

    for (const route of routes) {
      const key = `${route.locale}:${route.publicPath}`;
      const existing = byPath.get(key);

      if (existing) {
        return yield* Effect.fail(
          new DuplicatePublicRouteError({
            duplicateKind: route.kind,
            existingKind: existing.kind,
            locale: route.locale,
            publicPath: route.publicPath,
          })
        );
      }

      byPath.set(key, route);
    }

    return [...byPath.values()].sort(comparePublicRouteOrder);
  });
}

/** Removes accidental duplicate separators before path decoding. */
export function normalizePublicPath(path: string) {
  return path.split("/").filter(Boolean).join("/");
}

/** Reads the parent public path from an already decoded path string. */
export function getParentPath(path: string) {
  return path.split("/").slice(0, -1).join("/");
}

/** Removes the localized public namespace segment from a projected path. */
export function readPathWithoutNamespace(path: string) {
  return path.split("/").slice(1).join("/");
}

/** Orders route siblings by source-owned order and then stable public path. */
export function comparePublicRouteOrder(
  left: Pick<PublicRoute, "publicPath"> & { readonly order?: number },
  right: Pick<PublicRoute, "publicPath"> & { readonly order?: number }
) {
  const orderDifference = (left.order ?? 0) - (right.order ?? 0);

  if (orderDifference !== 0) {
    return orderDifference;
  }

  return left.publicPath.localeCompare(right.publicPath);
}

/** Decodes source-owned domain rows before route projection consumes them. */
export function decodeRouteDomains(domains: readonly unknown[]) {
  return Schema.decodeUnknown(Schema.Array(MaterialRouteDomainSchema))(
    domains
  ).pipe(Effect.mapError(toInvalidSourceError));
}

/** Joins already-decoded path segments while dropping absent optional segments. */
function joinRouteSegments(segments: readonly (string | undefined)[]) {
  return segments.filter((segment) => segment && segment.length > 0).join("/");
}

/** Maps schema decode failures into the route projection error channel. */
function toInvalidSourceError(error: unknown) {
  return new InvalidPublicRouteSourceError({
    message: String(error),
  });
}
