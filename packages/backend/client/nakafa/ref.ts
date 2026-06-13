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

/** Resolves a graph content ID, resource URI, or canonical URL projection. */
export function resolveNakafaContentRef(convexUrl: string, input: string) {
  const contentId = Schema.decodeUnknownOption(NakafaAgentContentIdSchema)(
    normalizeNakafaContentInput(input)
  );

  if (Option.isSome(contentId)) {
    return resolveNakafaContentId(convexUrl, contentId.value);
  }

  if (!isNakafaUrlProjection(input)) {
    return Effect.succeed(Option.none<NakafaAgentContentRef>());
  }

  return Effect.succeed(parseNakafaContentRef(input));
}

/** Resolves one graph asset ID through the backend route catalog. */
function resolveNakafaContentId(convexUrl: string, contentId: string) {
  return Effect.gen(function* () {
    const route = yield* fetchNakafaRuntimeQuery(
      convexUrl,
      "getContentRouteByContentId",
      api.contents.queries.runtime.getContentRouteByContentId,
      { contentId }
    );

    if (!route) {
      return Option.none<NakafaAgentContentRef>();
    }

    return Option.some(
      buildNakafaContentRef(route.locale, route.route, route.section)
    );
  });
}

/** Accepts public URLs as route projections without accepting bare route refs. */
function isNakafaUrlProjection(input: string) {
  const trimmed = input.trim();

  return (
    URL.canParse(trimmed) && normalizeNakafaContentInput(trimmed) !== trimmed
  );
}
