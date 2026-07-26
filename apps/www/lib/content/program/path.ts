import "server-only";

import { api } from "@repo/backend/convex/_generated/api";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { decodeCurriculumJson } from "@/lib/content/program/decode";
import {
  fetchRuntimeQuery,
  readRuntimeQuery,
} from "@/lib/content/runtime/query";

/** Resolves one exact curriculum path without loading its full page model. */
export const readPublishedProgramPath = Effect.fn(
  "NakafaProgram.readPublishedPath"
)(function* (locale: Locale, publicPath: string) {
  const result = yield* readRuntimeQuery("contentRelease.program.path", () =>
    fetchRuntimeQuery(api.contentRelease.program.path, { locale, publicPath })
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
  if (route.locale !== locale || route.publicPath !== publicPath) {
    return { managed: true, route: null };
  }
  return { managed: true, route };
});
