import { api as convexApi } from "@repo/backend/convex/_generated/api";
import { api } from "@repo/connection/routes";
import { routing } from "@repo/internationalization/src/routing";
import { cleanSlug } from "@repo/utilities/helper";
import { fetchMutation } from "convex/nextjs";

function stripLocalePrefix(slug: string) {
  const slugParts = cleanSlug(slug).split("/");
  const firstSegment = slugParts[0];

  if (!routing.locales.some((locale) => locale === firstSegment)) {
    return slugParts;
  }

  return slugParts.slice(1);
}

/**
 * Checks whether the given URL corresponds to verified content by querying
 * the appropriate content API (Quran surah, exercises, or general content).
 *
 * @returns `true` if the content exists and is verified, `false` otherwise.
 */
export async function getVerified(url: string) {
  const cleanedUrl = cleanSlug(url);
  const slugParts = stripLocalePrefix(cleanedUrl);

  if (slugParts[0] === "quran") {
    const [, surah, ...extraSegments] = slugParts;

    if (!(surah && extraSegments.length === 0)) {
      return false;
    }

    const surahNumber = Number(surah);

    if (!Number.isInteger(surahNumber)) {
      return false;
    }

    const { data: surahData, error: surahError } = await api.contents.getSurah({
      surah: surahNumber,
    });
    if (surahError) {
      return false;
    }
    return surahData !== null;
  }

  if (slugParts[0] === "exercises") {
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
  const userInfo = await fetchMutation(
    convexApi.users.mutations.syncUserInfoForChat,
    {},
    {
      token,
    }
  );
  return userInfo;
}
