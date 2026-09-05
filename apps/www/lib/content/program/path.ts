import "server-only";

import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { readProgramPath } from "@repo/backend/content/program/path";
import { api } from "@repo/backend/convex/_generated/api";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { decodeCurriculumJson } from "@/lib/content/program/decode";
import { readRuntimeQuery } from "@/lib/content/runtime/query";

/** Resolves one exact curriculum path without loading its full page model. */
export const readPublishedProgramPath = Effect.fn(
  "NakafaProgram.readPublishedPath"
)(function* (locale: Locale, publicPath: string) {
  const appLocale = AppLocaleSchema.make(locale);
  const result = yield* readRuntimeQuery(
    api.contentRelease.program.path,
    {
      appLocale,
      publicPath,
    },
    (queryArgs) => readProgramPath(queryArgs.appLocale, queryArgs.publicPath)
  );
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
    return { managed: true, route: null };
  }
  return { managed: true, route };
});
