import { getExerciseGroupArgs } from "@repo/backend/client/nakafa/exercise";
import { fetchNakafaRuntimeQuery } from "@repo/backend/client/nakafa/query";
import { resolveNakafaContentRef } from "@repo/backend/client/nakafa/ref";
import { api } from "@repo/backend/convex/_generated/api";
import { parseNakafaContentRef } from "@repo/contents/_lib/agent/refs";
import type { NakafaAgentContentRef } from "@repo/contents/_lib/agent/schema/ref";
import { Effect, Option } from "effect";

/** Verifies a normalized content reference through Convex runtime queries. */
export function verifyNakafaContent(convexUrl: string, input: string) {
  return Effect.gen(function* () {
    const ref = yield* resolveNakafaContentRef(convexUrl, input);

    if (Option.isNone(ref)) {
      return yield* verifyExerciseGroupUrlProjection(convexUrl, input);
    }

    const route = yield* fetchNakafaRuntimeQuery(
      convexUrl,
      "getContentRoute",
      api.contents.queries.runtime.getContentRoute,
      {
        locale: ref.value.locale,
        route: ref.value.route,
      }
    );

    if (route) {
      return true;
    }

    if (ref.value.section !== "exercises") {
      return false;
    }

    return yield* verifyExerciseGroupRoute(convexUrl, ref.value);
  }).pipe(Effect.catchAll(() => Effect.succeed(false)));
}

/** Verifies supported exercise collection URLs without accepting bare routes. */
function verifyExerciseGroupUrlProjection(convexUrl: string, input: string) {
  const ref = parseNakafaContentRef(input);

  if (Option.isNone(ref) || ref.value.section !== "exercises") {
    return Effect.succeed(false);
  }

  return verifyExerciseGroupRoute(convexUrl, ref.value);
}

/** Verifies exercise group routes that are not concrete synced rows. */
function verifyExerciseGroupRoute(
  convexUrl: string,
  ref: NakafaAgentContentRef
) {
  const groupArgs = getExerciseGroupArgs(ref.locale, ref.route);

  if (Option.isNone(groupArgs)) {
    return Effect.succeed(false);
  }

  return Effect.gen(function* () {
    const group = yield* fetchNakafaRuntimeQuery(
      convexUrl,
      "getExerciseGroupPage",
      api.contents.queries.runtime.getExerciseGroupPage,
      groupArgs.value
    );

    return group !== null;
  });
}
