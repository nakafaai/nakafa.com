import { fetchNakafaRuntimeQuery } from "@repo/backend/client/nakafa/query";
import { api } from "@repo/backend/convex/_generated/api";
import {
  buildNakafaContentRef,
  normalizeNakafaContentInput,
  parseNakafaContentRef,
} from "@repo/contents/_lib/agent/refs";
import {
  NakafaAgentContentIdSchema,
  type NakafaAgentContentRef,
} from "@repo/contents/_lib/agent/schema/ref";
import { Effect, Option, Schema } from "effect";

/** Resolves a route, URL, resource URI, or graph content ID into a content ref. */
export function resolveNakafaContentRef(convexUrl: string, input: string) {
  const parsed = parseNakafaContentRef(input);

  if (Option.isSome(parsed)) {
    return Effect.succeed(parsed);
  }

  const contentId = Schema.decodeUnknownOption(NakafaAgentContentIdSchema)(
    normalizeNakafaContentInput(input)
  );

  if (Option.isNone(contentId)) {
    return Effect.succeed(Option.none<NakafaAgentContentRef>());
  }

  return Effect.gen(function* () {
    const route = yield* fetchNakafaRuntimeQuery(
      convexUrl,
      "getContentRouteByContentId",
      api.contents.queries.runtime.getContentRouteByContentId,
      { contentId: contentId.value }
    );

    if (!route) {
      return Option.none<NakafaAgentContentRef>();
    }

    return Option.some(
      buildNakafaContentRef(route.locale, route.route, route.section)
    );
  });
}
