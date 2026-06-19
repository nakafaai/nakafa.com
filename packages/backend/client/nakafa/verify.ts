import { getExerciseTarget } from "@repo/backend/client/nakafa/exercise";
import { fetchNakafaRuntimeQuery } from "@repo/backend/client/nakafa/query";
import { resolveNakafaContentRef } from "@repo/backend/client/nakafa/ref";
import { api } from "@repo/backend/convex/_generated/api";
import type { NakafaAgentContentRef } from "@repo/contents/_lib/agent/schema/ref";
import { Effect, Option } from "effect";

const practiceMaterialRoutePrefix = "material/practice/";

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

    if (
      ref.value.section !== "material" ||
      !ref.value.route.startsWith(practiceMaterialRoutePrefix)
    ) {
      return true;
    }

    return yield* verifyReadableExerciseRoute(convexUrl, ref.value);
  }).pipe(Effect.catchAll(() => Effect.succeed(false)));
}

/** Verifies only exercise set/question routes that the exercise reader can load. */
function verifyReadableExerciseRoute(
  convexUrl: string,
  ref: NakafaAgentContentRef
) {
  const target = getExerciseTarget(ref.locale, ref.route);

  if (Option.isNone(target)) {
    return Effect.succeed(false);
  }

  return Effect.gen(function* () {
    const page = yield* fetchNakafaRuntimeQuery(
      convexUrl,
      "getExerciseSetPage",
      api.contents.queries.runtime.getExerciseSetPage,
      {
        locale: ref.locale,
        slug: target.value.setRoute,
      }
    );

    if (!page) {
      return false;
    }

    return Option.match(target.value.number, {
      onNone: () => true,
      onSome: (number) =>
        page.exercises.some((exercise) => exercise.number === number),
    });
  });
}
