import type { ContentReferenceInput } from "@repo/backend/convex/contentRelease/reference/spec";
import {
  normalizeNakafaContentInput,
  parseNakafaUrlRoute,
} from "@repo/contents/_lib/agent/refs";
import { NakafaAgentContentIdSchema } from "@repo/contents/_lib/agent/schema/ref";
import { Option, Schema } from "effect";

/** Produces one semantic lookup from a graph identity or public URL. */
export function getAgentContentReferenceInput(input: string) {
  const contentId = Schema.decodeOption(NakafaAgentContentIdSchema)(
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
