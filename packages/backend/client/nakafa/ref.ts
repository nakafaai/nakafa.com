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
import type { FunctionArgs } from "convex/server";
import { Effect, Option, Schema } from "effect";

type ContentReferenceInput = FunctionArgs<
  typeof api.contentRelease.reference.read
>["input"];

/** Produces one current semantic lookup from a graph identity or public URL. */
export function getContentReferenceInput(input: string) {
  const contentId = Schema.decodeUnknownOption(NakafaAgentContentIdSchema)(
    normalizeNakafaContentInput(input)
  );
  if (Option.isSome(contentId)) {
    return Option.some<ContentReferenceInput>({
      contentId: contentId.value,
      kind: "content",
    });
  }

  const route = parseNakafaUrlRoute(input);
  if (Option.isNone(route)) {
    return Option.none<ContentReferenceInput>();
  }

  return Option.some<ContentReferenceInput>({
    appLocale: route.value.locale,
    kind: "route",
    publicPath: route.value.route,
  });
}

/** Resolves a graph content ID, resource URI, or canonical URL projection. */
export function resolveNakafaContentRef(convexUrl: string, input: string) {
  const lookup = getContentReferenceInput(input);
  if (Option.isNone(lookup)) {
    return Effect.succeed(Option.none<NakafaAgentContentRef>());
  }
  return Effect.gen(function* () {
    const reference = yield* readNakafaRuntimeQuery(
      convexUrl,
      api.contentRelease.reference.read,
      { input: lookup.value }
    );
    if (!reference) {
      return Option.none<NakafaAgentContentRef>();
    }
    return createNakafaContentRefFromGraphProjection(reference);
  });
}
