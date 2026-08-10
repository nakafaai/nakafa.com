import { readNakafaRuntimeQuery } from "@repo/backend/client/nakafa/query";
import { api } from "@repo/backend/convex/_generated/api";
import {
  createNakafaContentRefFromGraphProjection,
  normalizeNakafaContentInput,
  parseNakafaUrlRoute,
} from "@repo/contents/_lib/agent/refs";
import {
  NakafaAgentContentIdSchema,
  type NakafaAgentContentRef,
} from "@repo/contents/_lib/agent/schema/ref";
import { readNamespaceSegment } from "@repo/contents/_types/route/path";
import type { FunctionArgs } from "convex/server";
import { Effect, Option, Schema } from "effect";

type MaterialLookupInput = FunctionArgs<
  typeof api.contentRelease.material.lookup
>["input"];

/** Produces the exact material lookup accepted by the active owner query. */
export function getMaterialLookupInput(input: string) {
  const contentId = Schema.decodeUnknownOption(NakafaAgentContentIdSchema)(
    normalizeNakafaContentInput(input)
  );
  if (Option.isSome(contentId)) {
    return Option.some<MaterialLookupInput>({
      contentId: contentId.value,
      kind: "content",
    });
  }

  const route = parseNakafaUrlRoute(input);
  if (Option.isNone(route)) {
    return Option.none<MaterialLookupInput>();
  }
  const namespace = readNamespaceSegment("subject", route.value.locale);
  if (route.value.route.split("/").at(0) !== namespace) {
    return Option.none<MaterialLookupInput>();
  }

  return Option.some<MaterialLookupInput>({
    kind: "route",
    locale: route.value.locale,
    publicPath: route.value.route,
  });
}

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
    const route = yield* readNakafaRuntimeQuery(
      convexUrl,
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
    const parsed = parseNakafaUrlRoute(input);

    if (Option.isNone(parsed)) {
      return Option.none<NakafaAgentContentRef>();
    }

    const route = yield* readNakafaRuntimeQuery(
      convexUrl,
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
