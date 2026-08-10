import { readNakafaRuntimeQuery } from "@repo/backend/client/nakafa/query";
import {
  getMaterialLookupInput,
  resolveNakafaContentRef,
} from "@repo/backend/client/nakafa/ref";
import { verifyNakafaReleasePin } from "@repo/backend/client/nakafa/release";
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
    let expectedActiveReleaseId: string | null | undefined;
    if (Option.isSome(materialInput)) {
      const material = yield* readNakafaRuntimeQuery(
        convexUrl,
        api.contentRelease.material.lookup,
        { input: materialInput.value }
      );
      expectedActiveReleaseId = material.activeReleaseId;
      if (material.managed) {
        return material.route !== null;
      }
    }

    if (Option.isNone(ref)) {
      return false;
    }

    const verified = yield* verifySourceContent(
      convexUrl,
      ref.value.content_id
    );
    if (expectedActiveReleaseId !== undefined) {
      yield* verifyNakafaReleasePin(convexUrl, expectedActiveReleaseId);
    }
    return verified;
  });
}

/** Verifies one source-owned identity remains present in the active catalog. */
function verifySourceContent(convexUrl: string, contentId: string) {
  return readNakafaRuntimeQuery(
    convexUrl,
    api.contents.queries.runtime.getContentRouteByContentId,
    { contentId }
  ).pipe(Effect.map((route) => route !== null));
}
