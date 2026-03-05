import { api as convexApi } from "@repo/backend/convex/_generated/api";
import { api } from "@repo/connection/routes";
import { cleanSlug } from "@repo/utilities/helper";
import { fetchQuery } from "convex/nextjs";

const QURAN_SLUG_PARTS_COUNT = 3;

/**
 * Checks whether the given URL corresponds to verified content by querying
 * the appropriate content API (Quran surah, exercises, or general content).
 *
 * @returns `true` if the content exists and is verified, `false` otherwise.
 */
export async function getVerified(url: string) {
  const cleanedUrl = cleanSlug(url);

  // [0] is locale, [1] is slug
  const slugParts = cleanedUrl.split("/");

  if (slugParts[1] === "quran") {
    if (slugParts.length !== QURAN_SLUG_PARTS_COUNT) {
      return false;
    }
    // example: locale/quran/surah
    const surah = slugParts[2];
    const { data: surahData, error: surahError } = await api.contents.getSurah({
      surah: Number.parseInt(surah, 10),
    });
    if (surahError) {
      return false;
    }
    return surahData !== null;
  }

  if (slugParts[1] === "exercises") {
    const { data: exercisesData, error: exercisesError } =
      await api.contents.getExercises({
        slug: cleanedUrl,
      });
    if (exercisesError) {
      return false;
    }
    return exercisesData !== null;
  }

  const { data: contentData, error: contentError } =
    await api.contents.getContent({
      slug: cleanedUrl,
    });

  if (contentError) {
    return false;
  }

  return contentData !== null;
}

/**
 * Fetches the authenticated user's role and credit balance from Convex,
 * used for access control and credit gating before the chat stream starts.
 */
export async function getUserInfo(token: string) {
  const userInfo = await fetchQuery(
    convexApi.users.queries.getUserInfoForChat,
    {},
    {
      token,
    }
  );
  return userInfo;
}
