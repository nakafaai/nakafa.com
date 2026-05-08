import { api as convexApi } from "@repo/backend/convex/_generated/api";
import { getContent } from "@repo/contents/_lib/content";
import {
  getExerciseByNumber,
  getExercisesContent,
} from "@repo/contents/_lib/exercises/set";
import { getExerciseSetTarget } from "@repo/contents/_lib/exercises/slug";
import { getSurah } from "@repo/contents/_lib/quran";
import { LocaleSchema } from "@repo/contents/_types/content";
import { cleanSlug } from "@repo/utilities/helper";
import { fetchMutation } from "convex/nextjs";
import { Effect, Either, Option } from "effect";

/**
 * Parses a chat page URL into the locale and content path used by the contents
 * package.
 *
 * @see https://effect.website/docs/data-types/option/
 */
function getContentRoute(url: string) {
  const slugParts = cleanSlug(url).split("/").filter(Boolean);
  const localeResult = LocaleSchema.safeParse(slugParts[0]);

  if (!localeResult.success) {
    return Option.none();
  }

  const segments = slugParts.slice(1);

  return Option.some({
    locale: localeResult.data,
    path: segments.join("/"),
    segments,
  });
}

/**
 * Checks whether the given URL corresponds to verified content by querying
 * the appropriate content API (Quran surah, exercises, or general content).
 *
 * @returns `true` if the content exists and is verified, `false` otherwise.
 */
export const getVerified = Effect.fn("chat.getVerified")(function* (
  url: string
) {
  const route = getContentRoute(url);

  if (Option.isNone(route)) {
    return false;
  }

  const { locale, path, segments } = route.value;

  if (segments[0] === "quran") {
    const [, surah, ...extraSegments] = segments;

    if (!(surah && extraSegments.length === 0)) {
      return false;
    }

    const surahNumber = Number(surah);

    if (!Number.isInteger(surahNumber)) {
      return false;
    }

    const surahData = yield* Effect.either(getSurah(surahNumber));
    return Either.isRight(surahData);
  }

  if (segments[0] === "exercises") {
    const target = getExerciseSetTarget(path);
    const exercisesData = yield* Effect.either(
      Option.match(target.exerciseNumber, {
        onNone: () =>
          getExercisesContent({
            locale,
            filePath: target.filePath,
            includeMDX: false,
          }),
        onSome: (exerciseNumber) =>
          getExerciseByNumber(
            locale,
            target.filePath,
            exerciseNumber,
            false
          ).pipe(
            Effect.map((exercise) =>
              Option.match(exercise, {
                onNone: () => [],
                onSome: (item) => [item],
              })
            )
          ),
      })
    );

    if (Either.isLeft(exercisesData)) {
      return false;
    }

    return exercisesData.right.length > 0;
  }

  const contentData = yield* Effect.either(
    getContent(locale, path, { includeMDX: false })
  );

  return Either.isRight(contentData);
});

/**
 * Fetches the authenticated user's role and credit balance from Convex,
 * used for access control and credit gating before the chat stream starts.
 */
export const getUserInfo = Effect.fn("chat.getUserInfo")(function* (
  token: string
) {
  return yield* Effect.tryPromise(() =>
    fetchMutation(
      convexApi.users.mutations.syncUserInfoForChat,
      {},
      {
        token,
      }
    )
  );
});
