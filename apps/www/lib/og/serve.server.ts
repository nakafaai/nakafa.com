import "@tanstack/react-start/server-only";

import {
  DEFAULT_LOCALE,
  decodeLocale,
  type Locale,
} from "@repo/internationalization/src/locale";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { generateOGImage } from "@/lib/og";
import { readOgCopy } from "@/lib/og/copy.server";
import { generateFallbackImage } from "@/lib/og/fallback";

const IMAGE_FILE = "image.png";

/** Splits a catch-all path into its segments, ignoring empty ones. */
function readSegments(splat: string | undefined) {
  return Arr.filter((splat ?? "").split("/"), (segment) => segment !== "");
}

/** Drops the image file name that the social tags append to a route. */
function readContentSlug(segments: readonly string[]) {
  return Option.exists(Arr.last(segments), (segment) => segment === IMAGE_FILE)
    ? Arr.dropRight(segments, 1)
    : segments;
}

/**
 * Renders the social image of one route. A route that names no published
 * content answers the brand fallback with 404, so bots that ask for unknown
 * routes never see the application shell.
 */
const renderOgImage = Effect.fn("www.og.render")(function* (
  locale: Locale,
  slug: readonly string[]
) {
  const copy = yield* readOgCopy(locale, slug);
  if (Option.isNone(copy)) {
    return yield* generateFallbackImage(locale);
  }
  return yield* Effect.sync(() =>
    generateOGImage({
      description: copy.value.description,
      title: copy.value.title,
    })
  );
});

/** The splat of an `/og/...` path. */
const OgImageParamsSchema = Schema.Struct({
  _splat: Schema.optionalKey(Schema.String),
});

/** The splat of a localized `/<locale>/og/...` path. */
const LocaleOgImageParamsSchema = Schema.Struct({
  _splat: Schema.optionalKey(Schema.String),
  lang: Schema.String,
});

/** Serves the social image of a route whose locale prefix is optional. */
export function serveOgImage({
  params,
}: {
  readonly params: typeof OgImageParamsSchema.Type;
}) {
  const segments = readSegments(params._splat);
  const prefix = decodeLocale(segments[0]);
  const locale = Option.getOrElse(prefix, () => DEFAULT_LOCALE);
  const slug = Option.isSome(prefix) ? Arr.drop(segments, 1) : segments;
  return Effect.runPromise(renderOgImage(locale, readContentSlug(slug)));
}

/**
 * Serves the social image of a localized route. The route validates its own
 * locale and does not use the `$locale` route: that route's parser throws the
 * router's not-found, which a server route answers as an error instead of 404.
 */
export function serveLocaleOgImage({
  params,
}: {
  readonly params: typeof LocaleOgImageParamsSchema.Type;
}) {
  const locale = decodeLocale(params.lang);
  if (Option.isNone(locale)) {
    return Effect.runPromise(generateFallbackImage(DEFAULT_LOCALE));
  }
  return Effect.runPromise(
    renderOgImage(locale.value, readContentSlug(readSegments(params._splat)))
  );
}
