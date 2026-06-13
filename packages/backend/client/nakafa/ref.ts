import { fetchNakafaRuntimeQuery } from "@repo/backend/client/nakafa/query";
import { api } from "@repo/backend/convex/_generated/api";
import {
  createNakafaContentRefFromGraphProjection,
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

  return resolveNakafaContentUrlProjection(convexUrl, input);
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

    return createNakafaContentRefFromGraphProjection(route);
  });
}

/** Resolves one canonical public URL through the backend route catalog. */
function resolveNakafaContentUrlProjection(convexUrl: string, input: string) {
  return Effect.gen(function* () {
    const parsed = parseNakafaContentRef(input);

    if (Option.isNone(parsed)) {
      return Option.none<NakafaAgentContentRef>();
    }

    const route = yield* fetchNakafaRuntimeQuery(
      convexUrl,
      "getContentRoute",
      api.contents.queries.runtime.getContentRoute,
      {
        locale: parsed.value.locale,
        route: parsed.value.route,
      }
    );

    if (!route) {
      return Option.none<NakafaAgentContentRef>();
    }

    return createNakafaContentRefFromGraphProjection(route);
  });
}

/** Accepts public URLs as route projections without accepting bare route refs. */
function isNakafaUrlProjection(input: string) {
  const trimmed = input.trim();

  return (
    URL.canParse(trimmed) && normalizeNakafaContentInput(trimmed) !== trimmed
  );
}
