import { fetchNakafaRuntimeQuery } from "@repo/backend/client/nakafa/query";
import { resolveNakafaContentRef } from "@repo/backend/client/nakafa/ref";
import { api } from "@repo/backend/convex/_generated/api";
import { Effect, Option } from "effect";

/** Verifies a normalized content reference through Convex runtime queries. */
export function verifyNakafaContent(convexUrl: string, input: string) {
  return Effect.gen(function* () {
    const ref = yield* resolveNakafaContentRef(convexUrl, input);

    if (Option.isNone(ref)) {
      return false;
    }

    const route = yield* fetchNakafaRuntimeQuery(
      convexUrl,
      "getContentRouteByContentId",
      api.contents.queries.runtime.getContentRouteByContentId,
      {
        contentId: ref.value.content_id,
      }
    );

    if (!route) {
      return false;
    }

    return true;
  }).pipe(Effect.catchAll(() => Effect.succeed(false)));
}
