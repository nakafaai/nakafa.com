import { HttpClient } from "@confect/js";
import "server-only";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import refs from "@repo/backend/confect/_generated/refs";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { decodeCurriculumJson } from "@/lib/content/program/decode";
import { httpLayer } from "@/lib/convex/http";

/** Resolves one exact curriculum path without loading its full page model. */
export const readPublishedProgramPath = Effect.fn(
  "NakafaProgram.readPublishedPath"
)(function* (locale: Locale, publicPath: string) {
  const appLocale = AppLocaleSchema.make(locale);
  const result = yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(refs.public.contentRelease.program.path, {
      appLocale,
      publicPath,
    })
  ).pipe(Effect.provide(httpLayer()));
  if (!(result.managed && result.routeJson)) {
    return {
      managed: result.managed,
      route: null,
    };
  }
  const route = yield* decodeCurriculumJson(
    result.routeJson,
    locale,
    publicPath
  );
  if (route.appLocale !== appLocale || route.publicPath !== publicPath) {
    return {
      managed: true,
      route: null,
    };
  }
  return {
    managed: true,
    route,
  };
});
