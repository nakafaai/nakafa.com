import "@tanstack/react-start/server-only";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { Effect } from "effect";
import type { Locale } from "use-intl";
import { decodeCurriculumJson } from "@/lib/content/program/decode";
import { queryContentStore } from "@/lib/content/store/query";

/** Resolves one exact curriculum path without loading its full page model. */
export const readPublishedProgramPath = Effect.fn(
  "NakafaProgram.readPublishedPath"
)(function* (locale: Locale, publicPath: string) {
  const appLocale = AppLocaleSchema.make(locale);
  const result = yield* queryContentStore(contentRelease.program.path, {
    appLocale,
    publicPath,
  });
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
