import { fetchNakafaRuntimeQuery } from "@repo/backend/client/nakafa/query";
import {
  getMaterialLookupInput,
  resolveNakafaContentRef,
} from "@repo/backend/client/nakafa/ref";
import { api } from "@repo/backend/convex/_generated/api";
import { Effect, Option } from "effect";

/** Verifies a normalized content reference through Convex runtime queries. */
export function verifyNakafaContent(convexUrl: string, input: string) {
  return Effect.gen(function* () {
    const ref = yield* resolveNakafaContentRef(convexUrl, input);

    if (Option.isSome(ref) && ref.value.section !== "material") {
      return yield* verifySourceContent(convexUrl, ref.value.content_id);
    }

    const materialInput = getMaterialLookupInput(input);
    if (Option.isSome(materialInput)) {
      const material = yield* fetchNakafaRuntimeQuery(
        convexUrl,
        "lookupMaterial",
        api.contentRelease.material.lookup,
        { input: materialInput.value }
      );
      if (material.managed) {
        return material.route !== null;
      }
    }

    if (Option.isNone(ref)) {
      return false;
    }

    return yield* verifySourceContent(convexUrl, ref.value.content_id);
  });
}

/** Verifies one source-owned identity remains present in the active catalog. */
function verifySourceContent(convexUrl: string, contentId: string) {
  return fetchNakafaRuntimeQuery(
    convexUrl,
    "getContentRouteByContentId",
    api.contents.queries.runtime.getContentRouteByContentId,
    { contentId }
  ).pipe(Effect.map((route) => route !== null));
}
