import { resolveNakafaContentRef } from "@repo/backend/client/nakafa/ref";
import { Effect, Option } from "effect";

/** Verifies a normalized content reference through Convex runtime queries. */
export function verifyNakafaContent(convexUrl: string, input: string) {
  return Effect.gen(function* () {
    const ref = yield* resolveNakafaContentRef(convexUrl, input);
    return Option.isSome(ref);
  });
}
