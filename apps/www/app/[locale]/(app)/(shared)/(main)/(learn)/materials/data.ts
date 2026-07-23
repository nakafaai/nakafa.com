import {
  type RendererDomain,
  RendererDomainSchema,
} from "@nakafa/aksara-contracts/renderer/domain";
import { type Locale, LocaleSchema } from "@repo/contents/_types/content";
import {
  isMaterialLessonRoute,
  readMaterialPagination,
  readParentMaterialRoute,
  toLocalizedContentHref,
} from "@repo/contents/_types/route/content";
import { readStaticPublicContentRoutes } from "@repo/contents/_types/route/content/static";
import { readStaticPublicLearningIndex } from "@repo/contents/_types/route/learning/static";
import type { MaterialContextIdentity } from "@repo/contents/_types/route/material/reference";
import { readNamespaceSegment } from "@repo/contents/_types/route/path";
import type {
  PublicContentRoute,
  PublicRoute,
} from "@repo/contents/_types/route/schema";
import { Effect, Either, Option, Schema } from "effect";
import {
  type MaterialStaticParam,
  partitionMaterialStaticParams,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/params";
import type {
  MaterialRouteParams,
  MaterialRouteTarget,
  ResolvedMaterialRoute,
} from "@/lib/content/material";
import { matchesMaterialRouteTarget } from "@/lib/content/material";

/** A material route cannot be safely assigned to its physical renderer. */
export class MaterialRouteError extends Schema.TaggedError<MaterialRouteError>()(
  "MaterialRouteError",
  {
    reason: Schema.Literal(
      "locale",
      "parent-route",
      "public-path",
      "renderer-domain"
    ),
    value: Schema.String,
  }
) {}

/** Pure route result used by static framework boundaries. */
type MaterialResult<A> = Either.Either<A, MaterialRouteError>;

/** Decoded public path segments for one material route. */
interface MaterialPath {
  readonly lesson: readonly string[];
  readonly subject: string;
  readonly topic: string;
}

/** Lifts one pure route result into the Effect-native domain interface. */
function toEffect<A>(result: MaterialResult<A>) {
  if (Either.isLeft(result)) {
    return Effect.fail(result.left);
  }

  return Effect.succeed(result.right);
}

let materialRouteCache: readonly PublicContentRoute[] | undefined;

/** Lazily decodes content routes when a framework route function needs them. */
export function readMaterialRoutes() {
  if (materialRouteCache) {
    return materialRouteCache;
  }

  materialRouteCache = readStaticPublicContentRoutes();

  return materialRouteCache;
}

/** Decodes one renderer domain without starting an Effect runtime. */
function decodeDomain(
  route: PublicContentRoute
): MaterialResult<RendererDomain> {
  const rendererDomain = route.sourcePath.split("/")[2];
  const decoded =
    Schema.decodeUnknownEither(RendererDomainSchema)(rendererDomain);

  return Either.mapLeft(
    decoded,
    () =>
      new MaterialRouteError({
        reason: "renderer-domain",
        value: route.sourcePath,
      })
  );
}

/** Decodes the renderer domain from one projected material source identity. */
export const readMaterialRendererDomain = Effect.fn(
  "NakafaContent.readMaterialRendererDomain"
)((route: PublicContentRoute) => toEffect(decodeDomain(route)));

/** Decodes one locale without starting an Effect runtime. */
function decodeLocale(rawLocale: string): MaterialResult<Locale> {
  const decoded = Schema.decodeUnknownEither(LocaleSchema)(rawLocale);

  return Either.mapLeft(
    decoded,
    () => new MaterialRouteError({ reason: "locale", value: rawLocale })
  );
}

/** Decodes one Next locale param without entering the not-found boundary. */
function readMaterialLocale(rawLocale: string) {
  return toEffect(decodeLocale(rawLocale));
}

/** Reads path segments without starting an Effect runtime. */
function decodePath(route: PublicContentRoute): MaterialResult<MaterialPath> {
  const [, subject, topic, ...lesson] = route.publicPath.split("/");

  if (!(subject && topic)) {
    return Either.left(
      new MaterialRouteError({
        reason: "public-path",
        value: route.publicPath,
      })
    );
  }

  return Either.right({ lesson, subject, topic });
}

/** Reads the subject, topic, and lesson segments from one projected route. */
const readMaterialPath = Effect.fn("NakafaContent.readMaterialPath")(
  (route: PublicContentRoute) => toEffect(decodePath(route))
);

/** Builds the bounded static-param partitions shared by physical routes. */
const readMaterialStaticPartitions = Effect.fn(
  "NakafaContent.readMaterialStaticPartitions"
)(function* (rawLocale?: string) {
  const locale = rawLocale ? yield* readMaterialLocale(rawLocale) : undefined;
  const params: MaterialStaticParam[] = [];

  for (const route of readMaterialRoutes()) {
    if ((locale && route.locale !== locale) || !isMaterialLessonRoute(route)) {
      continue;
    }

    const { lesson, subject, topic } = yield* readMaterialPath(route);
    const rendererDomain = yield* readMaterialRendererDomain(route);

    params.push({
      lesson,
      rendererDomain,
      subject,
      topic,
    });
  }

  return partitionMaterialStaticParams(params);
});

/** Builds typed bounded params for the shared base-registry route. */
export const listGenericMaterialStaticParams = Effect.fn(
  "NakafaContent.listGenericMaterialStaticParams"
)(function* (rawLocale?: string) {
  const { generic } = yield* readMaterialStaticPartitions(rawLocale);

  return generic.map(({ lesson, subject, topic }) => ({
    lesson,
    subject,
    topic,
  }));
});

/** Builds typed bounded params for one fixed-domain material route. */
export const listDomainMaterialStaticParams = Effect.fn(
  "NakafaContent.listDomainMaterialStaticParams"
)(function* (
  target: Exclude<MaterialRouteTarget, "generic">,
  rawLocale?: string
) {
  const partition = yield* readMaterialStaticPartitions(rawLocale);

  return partition[target].map(({ lesson, topic }) => ({ lesson, topic }));
});

/** Narrows indexed public-route lookups to source-owned material rows only. */
function isProjectedMaterialContentRoute(
  route: PublicRoute | undefined
): route is PublicContentRoute {
  return Boolean(
    route && (route.kind === "subject-topic" || route.kind === "subject-lesson")
  );
}

/** Finds a fixed-domain subject without starting an Effect runtime. */
function findSubject(
  locale: Locale,
  target: Exclude<MaterialRouteTarget, "generic">
): MaterialResult<string | undefined> {
  for (const candidate of readMaterialRoutes()) {
    if (candidate.locale !== locale) {
      continue;
    }

    const rendererDomain = decodeDomain(candidate);
    if (Either.isLeft(rendererDomain)) {
      return Either.left(rendererDomain.left);
    }
    if (rendererDomain.right !== target) {
      continue;
    }

    const path = decodePath(candidate);
    if (Either.isLeft(path)) {
      return Either.left(path.left);
    }

    return Either.right(path.right.subject);
  }

  return Either.right(undefined);
}

/**
 * Resolves localized params without starting a timestamped Effect fiber.
 *
 * Static Server Components call this pure boundary before any request data.
 *
 * @see https://nextjs.org/docs/messages/next-prerender-current-time
 */
export function resolveMaterial(
  routeParams: MaterialRouteParams,
  target: MaterialRouteTarget
): MaterialResult<Option.Option<ResolvedMaterialRoute>> {
  const decodedLocale = decodeLocale(routeParams.locale);
  if (Either.isLeft(decodedLocale)) {
    return Either.left(decodedLocale.left);
  }

  const locale = decodedLocale.right;
  const namespace = readNamespaceSegment("subject", locale);
  let subject = routeParams.subject;

  if (target !== "generic") {
    const fixedSubject = findSubject(locale, target);
    if (Either.isLeft(fixedSubject)) {
      return Either.left(fixedSubject.left);
    }
    subject = fixedSubject.right;
  }

  if (!(namespace && subject)) {
    return Either.right(Option.none<ResolvedMaterialRoute>());
  }

  const publicPath = [
    namespace,
    subject,
    routeParams.topic,
    ...(routeParams.lesson ?? []),
  ].join("/");
  const route = readStaticPublicLearningIndex().resolveRouteByPath(
    publicPath,
    locale
  );

  if (
    !(isProjectedMaterialContentRoute(route) && isMaterialLessonRoute(route))
  ) {
    return Either.right(Option.none<ResolvedMaterialRoute>());
  }

  const rendererDomain = decodeDomain(route);
  if (Either.isLeft(rendererDomain)) {
    return Either.left(rendererDomain.left);
  }
  if (!matchesMaterialRouteTarget(rendererDomain.right, target)) {
    return Either.right(Option.none<ResolvedMaterialRoute>());
  }

  return Either.right(
    Option.some({ locale, rendererDomain: rendererDomain.right, route })
  );
}

/** Resolves the topic route without starting a timestamped Effect fiber. */
export function resolveParent(
  route: PublicContentRoute
): MaterialResult<PublicContentRoute> {
  const parent = readParentMaterialRoute(route, readMaterialRoutes());

  if (parent?.kind !== "subject-topic") {
    return Either.left(
      new MaterialRouteError({
        reason: "parent-route",
        value: route.publicPath,
      })
    );
  }

  return Either.right(parent);
}

/** Resolves localized params through the typed public route projection. */
export const readMaterialRoute = Effect.fn("NakafaContent.readMaterialRoute")(
  (routeParams: MaterialRouteParams, target: MaterialRouteTarget) =>
    toEffect(resolveMaterial(routeParams, target))
);

/** Resolves the topic route that structurally owns one lesson route. */
export const requireParentMaterialRoute = Effect.fn(
  "NakafaContent.requireParentMaterialRoute"
)((route: PublicContentRoute) => toEffect(resolveParent(route)));

/** Resolves the material header link from an explicit curriculum context. */
export function readMaterialHeaderLink(
  route: PublicContentRoute,
  context: MaterialContextIdentity | undefined
) {
  return readStaticPublicLearningIndex().resolveMaterialHeaderLink({
    context,
    route,
  });
}

/** Builds sibling pagination while preserving a validated source context. */
export function readMaterialPagePagination(
  route: PublicContentRoute,
  context: MaterialContextIdentity | undefined
) {
  const index = readStaticPublicLearningIndex();

  if (!(context && index.resolveMaterialHeaderLink({ context, route }))) {
    return readMaterialPagination(route, readMaterialRoutes());
  }

  return readMaterialPagination(route, readMaterialRoutes(), {
    toHref: (targetRoute) =>
      index.toContextualMaterialHref({
        context,
        href: toLocalizedContentHref(targetRoute),
        route: targetRoute,
      }),
  });
}
